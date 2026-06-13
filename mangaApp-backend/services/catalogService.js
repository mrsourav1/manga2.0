import { createHash } from 'crypto';
import {
  CHAPTER_CACHE_TTL,
  DETAILS_CACHE_TTL,
  HOME_CACHE_TTL,
  PREFETCH_PAGES,
  SEARCH_CACHE_TTL,
  SEARCH_SOURCE_TIMEOUT_MS,
  SOURCE_PRIORITY,
} from '../config/constants.js';
import { getCache, setCache } from './cache.js';
import { runSingleFlight } from './refreshQueue.js';
import { normalizeTitle, uniqueStrings } from './scraper.js';
import { getSourceByName, getSourceForUrl, sources } from './sources/index.js';
import { markSourceFailure, markSourceSuccess } from './sourceHealth.js';

export class SourceUnavailableError extends Error {
  constructor(sourceName, cause) {
    super(`${sourceName} source unavailable`);
    this.name = 'SourceUnavailableError';
    this.sourceName = sourceName;
    this.cause = cause;
  }
}

const buildCacheEntry = (payload, ttlSeconds) => {
  const cachedAt = new Date();
  const expiresAt = new Date(cachedAt.getTime() + ttlSeconds * 1000);

  return {
    payload,
    meta: {
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ttlSeconds,
    },
  };
};

const normalizeCacheEntry = (entry) => {
  if (!entry) return null;
  if (Object.prototype.hasOwnProperty.call(entry, 'payload')) return entry;

  return {
    payload: entry,
    meta: {
      cachedAt: null,
      expiresAt: null,
      ttlSeconds: null,
    },
  };
};

const isExpired = (entry) => {
  if (!entry?.meta?.expiresAt) return true;
  return new Date(entry.meta.expiresAt).getTime() <= Date.now();
};

const withCacheMeta = (payload, entry, stale) => {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return payload;
  }

  return {
    ...payload,
    _cache: {
      cachedAt: entry?.meta?.cachedAt || null,
      expiresAt: entry?.meta?.expiresAt || null,
      stale,
    },
  };
};

const hashUrl = (url) => createHash('sha1').update(url).digest('hex');
const CACHE_VERSION = 'v11';

export const buildMangaId = (sourceName, sourceSlug) => `${sourceName}__${sourceSlug}`;

export const parseMangaId = (mangaId) => {
  const [sourceName, ...slugParts] = String(mangaId || '').split('__');
  const sourceSlug = slugParts.join('__');

  if (!sourceName || !sourceSlug) return null;

  return {
    sourceName,
    sourceSlug,
  };
};

const homePageKey = (page) => `catalog:${CACHE_VERSION}:home:page-${page}`;
const detailKey = (mangaId) => `catalog:${CACHE_VERSION}:details:${mangaId}`;
const chapterKey = (url) => `catalog:${CACHE_VERSION}:chapter:${hashUrl(url)}`;
const searchKey = (query) => `catalog:${CACHE_VERSION}:search:${hashUrl(query.trim().toLowerCase())}`;

const sourcePriority = (sourceName) => {
  const index = SOURCE_PRIORITY.indexOf(sourceName);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const withMangaIdentity = (item) => {
  if (!item?.source || !item?.sourceSlug) return item;

  const mangaId = buildMangaId(item.source, item.sourceSlug);
  return {
    ...item,
    mangaId,
    imgSlug: mangaId,
  };
};

const choosePreferredItem = (current, incoming) => {
  if (!current) return incoming;
  if (!incoming) return current;

  const currentPriority = sourcePriority(current.source);
  const incomingPriority = sourcePriority(incoming.source);

  if (incomingPriority < currentPriority) return incoming;
  if (incomingPriority > currentPriority) return current;

  if (!current.chapterUrl && incoming.chapterUrl) return incoming;
  if (!current.cover && incoming.cover) return incoming;
  if (!current.rating && incoming.rating) return incoming;

  return current;
};

const mergeMangaCollections = (items) => {
  const keyToGroup = new Map();
  const groups = [];

  for (const rawItem of items) {
    const item = withMangaIdentity(rawItem);
    if (!item?.title) continue;

    const keys = uniqueStrings(
      [item.title, ...(item.altTitles || [])]
        .map((value) => normalizeTitle(value))
        .filter(Boolean)
    );

    let group = null;
    for (const key of keys) {
      if (keyToGroup.has(key)) {
        group = keyToGroup.get(key);
        break;
      }
    }

    if (!group) {
      group = {
        primary: item,
        allSources: [
          {
            mangaId: item.mangaId,
            source: item.source,
            sourceSlug: item.sourceSlug,
            sourceUrl: item.sourceUrl || null,
            chapterUrl: item.chapterUrl || null,
          },
        ],
        altTitles: [...(item.altTitles || [])],
      };
      groups.push(group);
    } else {
      group.primary = choosePreferredItem(group.primary, item);
      group.altTitles = uniqueStrings([...group.altTitles, ...(item.altTitles || [])]);

      if (!group.allSources.some((source) => source.mangaId === item.mangaId)) {
        group.allSources.push({
          mangaId: item.mangaId,
          source: item.source,
          sourceSlug: item.sourceSlug,
          sourceUrl: item.sourceUrl || null,
          chapterUrl: item.chapterUrl || null,
        });
      }
    }

    for (const key of keys) {
      keyToGroup.set(key, group);
    }
  }

  return groups.map((group) => ({
    ...group.primary,
    altTitles: uniqueStrings([...(group.primary.altTitles || []), ...group.altTitles]),
    alternateSources: group.allSources.filter((source) => source.mangaId !== group.primary.mangaId),
  }));
};

const applyVisibleLatestChapters = async (items) => {
  const result = [];

  for (const item of items) {
    if (item?.source !== 'asura' || !item?.mangaId) {
      result.push(item);
      continue;
    }

    try {
      const details = await getMangaDetailsData(item.mangaId);
      const latestVisibleChapter = details?.chapters?.[details.chapters.length - 1];

      if (!latestVisibleChapter?.url) {
        result.push(item);
        continue;
      }

      result.push({
        ...item,
        latestChapter: latestVisibleChapter.title || item.latestChapter,
        latestChapterNumber: latestVisibleChapter.chapterNumber ?? item.latestChapterNumber,
        chapterUrl: latestVisibleChapter.url,
      });
    } catch {
      result.push(item);
    }
  }

  return result;
};

const markResult = (sourceName, error) => {
  if (error) {
    markSourceFailure(sourceName, error);
    return;
  }

  markSourceSuccess(sourceName);
};

const fetchSettled = async (source, task, { validate } = {}) => {
  try {
    const result = await task();

    if (validate && !validate(result)) {
      throw new Error(`Source returned empty ${source.name} payload`);
    }

    markResult(source.name, null);
    return { source: source.name, ok: true, result };
  } catch (error) {
    markResult(source.name, error);
    return { source: source.name, ok: false, error };
  }
};

const withTimeout = async (task, timeoutMs, label) => {
  let timer;

  try {
    return await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const refreshCacheEntry = async ({
  cacheKey,
  fetcher,
  sourceName,
  ttlSeconds,
  validate,
}) => {
  try {
    return await runSingleFlight(cacheKey, async () => {
      const payload = await fetcher();

      if (!validate(payload)) {
        throw new Error(`Source returned empty ${sourceName} payload`);
      }

      const entry = buildCacheEntry(payload, ttlSeconds);
      await setCache(cacheKey, entry, ttlSeconds);
      markSourceSuccess(sourceName);
      return entry;
    });
  } catch (error) {
    markSourceFailure(sourceName, error);
    throw error;
  }
};

const readCacheFirst = async ({
  cacheKey,
  fetchFresh,
  sourceName,
  decorate = true,
}) => {
  const cachedEntry = normalizeCacheEntry(await getCache(cacheKey));

  if (cachedEntry && !isExpired(cachedEntry)) {
    return decorate ? withCacheMeta(cachedEntry.payload, cachedEntry, false) : cachedEntry.payload;
  }

  if (cachedEntry) {
    void fetchFresh().catch((error) => {
      console.warn(`Background refresh failed for ${cacheKey}:`, error.message);
    });
    return decorate ? withCacheMeta(cachedEntry.payload, cachedEntry, true) : cachedEntry.payload;
  }

  let freshEntry;

  try {
    freshEntry = await fetchFresh();
  } catch (error) {
    throw new SourceUnavailableError(sourceName, error);
  }

  return decorate ? withCacheMeta(freshEntry.payload, freshEntry, false) : freshEntry.payload;
};

export const refreshHomePage = async (page = 1) =>
  refreshCacheEntry({
    cacheKey: homePageKey(page),
    fetcher: async () => {
      const settled = await Promise.all(
        sources.map((source) =>
          fetchSettled(source, () => source.getHome(page), {
            validate: (result) => Boolean(result) && Array.isArray(result.mangas),
          })
        )
      );

      const successfulResults = settled
        .filter((entry) => entry.ok && Array.isArray(entry.result?.mangas))
        .map((entry) => entry.result);

      if (successfulResults.length === 0) {
        throw new Error('No source returned homepage data');
      }

      const mergedMangas = mergeMangaCollections(
        successfulResults.flatMap((entry) => entry.mangas || [])
      );
      const hydratedMangas = await applyVisibleLatestChapters(mergedMangas);

      return {
        page,
        totalPages: Math.max(1, ...successfulResults.map((entry) => entry.totalPages || 1)),
        mangas: hydratedMangas,
        mangaLength: hydratedMangas.length,
        lastUpdated: new Date().toISOString(),
        sources: settled.map((entry) => ({
          source: entry.source,
          ok: entry.ok,
          mangaLength: entry.result?.mangas?.length || 0,
          error: entry.ok ? null : entry.error?.message || 'Unknown error',
        })),
      };
    },
    sourceName: 'catalog',
    ttlSeconds: HOME_CACHE_TTL,
    validate: (payload) => Array.isArray(payload?.mangas) && payload.mangas.length > 0,
  });

export const getHomePageData = async (page = 1) =>
  readCacheFirst({
    cacheKey: homePageKey(page),
    fetchFresh: () => refreshHomePage(page),
    sourceName: 'catalog',
  });

export const refreshMangaDetails = async (mangaId) =>
  refreshCacheEntry({
    cacheKey: detailKey(mangaId),
    fetcher: async () => {
      const parsed = parseMangaId(mangaId);
      if (!parsed) {
        throw new Error('Invalid manga id');
      }

      const source = getSourceByName(parsed.sourceName);
      if (!source) {
        throw new Error(`Unsupported source: ${parsed.sourceName}`);
      }

      try {
        const payload = await source.getDetails(parsed.sourceSlug);
        if (!payload) {
          throw new Error('Source returned empty details payload');
        }

        markResult(source.name, null);
        return withMangaIdentity(payload);
      } catch (error) {
        markResult(source.name, error);
        throw error;
      }
    },
    sourceName: 'details',
    ttlSeconds: DETAILS_CACHE_TTL,
    validate: (payload) => Boolean(payload?.title),
  });

export const getMangaDetailsData = async (mangaId) =>
  readCacheFirst({
    cacheKey: detailKey(mangaId),
    fetchFresh: () => refreshMangaDetails(mangaId),
    sourceName: 'details',
  });

export const refreshChapter = async (url) =>
  refreshCacheEntry({
    cacheKey: chapterKey(url),
    fetcher: async () => {
      const source = getSourceForUrl(url);
      if (!source) {
        throw new Error('Unsupported chapter source');
      }

      try {
        const payload = await source.getChapter(url);
        if (!payload) {
          throw new Error('Source returned empty chapter payload');
        }

        markResult(source.name, null);
        return payload;
      } catch (error) {
        markResult(source.name, error);
        throw error;
      }
    },
    sourceName: 'chapter',
    ttlSeconds: CHAPTER_CACHE_TTL,
    validate: (payload) => Array.isArray(payload?.images) && payload.images.length > 0,
  });

export const getChapterData = async (url) =>
  readCacheFirst({
    cacheKey: chapterKey(url),
    fetchFresh: () => refreshChapter(url),
    sourceName: 'chapter',
    decorate: false,
  });

export const refreshSearchResults = async (query) =>
  refreshCacheEntry({
    cacheKey: searchKey(query),
    fetcher: async () => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery) {
        return {
          query: '',
          results: [],
          resultCount: 0,
          lastUpdated: new Date().toISOString(),
          sources: [],
        };
      }

      const settled = await Promise.all(
        sources.map((source) =>
          fetchSettled(
            source,
            () =>
              withTimeout(
                () => source.search(trimmedQuery),
                SEARCH_SOURCE_TIMEOUT_MS,
                `${source.name} search`
              ),
            {
            validate: (result) => Array.isArray(result),
            }
          )
        )
      );

      const successfulResults = settled
        .filter((entry) => entry.ok && Array.isArray(entry.result))
        .flatMap((entry) => entry.result);

      if (settled.every((entry) => !entry.ok)) {
        throw new Error('All search sources failed');
      }

      const mergedResults = mergeMangaCollections(successfulResults);

      return {
        query: trimmedQuery,
        results: mergedResults,
        resultCount: mergedResults.length,
        lastUpdated: new Date().toISOString(),
        sources: settled.map((entry) => ({
          source: entry.source,
          ok: entry.ok,
          resultCount: entry.ok ? entry.result.length : 0,
          error: entry.ok ? null : entry.error?.message || 'Unknown error',
        })),
      };
    },
    sourceName: 'search',
    ttlSeconds: SEARCH_CACHE_TTL,
    validate: (payload) => Array.isArray(payload?.results),
  });

export const searchMangaData = async (query) =>
  readCacheFirst({
    cacheKey: searchKey(query),
    fetchFresh: () => refreshSearchResults(query),
    sourceName: 'search',
  });

export const prefetchHomePages = async (pageCount = PREFETCH_PAGES) => {
  for (let page = 1; page <= pageCount; page += 1) {
    try {
      await refreshHomePage(page);
    } catch (error) {
      console.warn(`Prefetch failed for homepage ${page}:`, error.message);
    }
  }
};
