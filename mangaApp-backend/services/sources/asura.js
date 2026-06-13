import { load } from 'cheerio';
import {
  buildAbsoluteUrl,
  extractChapterNumber,
  extractSlugFromUrl,
  fetchHtml,
  getJsonLdObjects,
  normalizeWhitespace,
  parseListText,
  uniqueStrings,
} from '../scraper.js';

const decodeHtml = (value = '') =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const normalizeAsuraCoverUrl = (baseUrl, url) => {
  const absoluteUrl = buildAbsoluteUrl(baseUrl, url);
  if (!absoluteUrl) return null;

  return absoluteUrl.replace(
    /(\.[^./?#]+)-\d+(?=\.(?:gif|jpe?g|png|webp)(?:$|[?#]))/i,
    '$1'
  );
};

const matchSerializedString = (html, key) => {
  const match = html.match(
    new RegExp(`&quot;${key}&quot;:\\[0,&quot;(.*?)&quot;`, 'i')
  );
  return match ? decodeHtml(match[1]) : null;
};

const matchSerializedNumber = (html, key) => {
  const match = html.match(new RegExp(`&quot;${key}&quot;:\\[0,([\\d.]+)`, 'i'));
  return match ? Number.parseFloat(match[1]) : null;
};

const getComicSeriesJsonLd = ($) =>
  getJsonLdObjects($).find((entry) => entry?.['@type'] === 'ComicSeries') || null;

const extractLockedChapterNumbers = (html = '') => {
  const lockedNumbers = new Set();
  const pattern =
    /&quot;slug&quot;:\[0,&quot;chapter-([\d.]+)[^&]*&quot;\][\s\S]{0,1200}?&quot;is_locked&quot;:\[0,true\]/gi;

  for (const match of html.matchAll(pattern)) {
    const number = Number.parseFloat(match[1]);
    if (Number.isFinite(number)) {
      lockedNumbers.add(number);
    }
  }

  return lockedNumbers;
};

const trailingDatePattern =
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}|(?:\d+\s+(?:minutes?|hours?|days?|weeks?|months?)\s+ago)|last week|yesterday|today|just now)$/i;

const stripRatingPrefix = (value = '') => value.replace(/^\d+(?:\.\d+)?\s*/, '').trim();

const extractTrailingDate = (value = '') => {
  const match = value.match(trailingDatePattern);
  return match ? normalizeWhitespace(match[1]) : null;
};

const buildChapterLabel = (text = '', chapterUrl) => {
  const chapterNumber = extractChapterNumber('', chapterUrl);
  if (chapterNumber == null) {
    return {
      title: normalizeWhitespace(text) || null,
      chapterNumber: null,
      date: extractTrailingDate(text),
    };
  }

  const fullText = normalizeWhitespace(text);
  const prefix = new RegExp(`^Chapter\\s*${chapterNumber}`, 'i');
  let remainder = fullText.replace(prefix, '').trim();
  const date = extractTrailingDate(remainder);

  if (date) {
    remainder = remainder.slice(0, remainder.length - date.length).trim();
  }

  remainder = remainder.replace(/^[\-:>]+/, '').trim();

  return {
    title: remainder ? `Chapter ${chapterNumber} - ${remainder}` : `Chapter ${chapterNumber}`,
    chapterNumber,
    date,
  };
};

const getSeriesPath = (href = '') => {
  const match = href.match(/(\/comics\/[^/]+)/);
  return match ? match[1] : null;
};

const getAnchorText = ($, href) => {
  const heading = $(`a[href="${href}"] h3`).first();
  if (heading.length) {
    return stripRatingPrefix(normalizeWhitespace(heading.text()));
  }

  const textAnchor = $(`a[href="${href}"]`)
    .filter((_, el) => $(el).find('img').length === 0 && normalizeWhitespace($(el).text()).length > 0)
    .first();

  if (textAnchor.length) {
    return stripRatingPrefix(normalizeWhitespace(textAnchor.text()));
  }

  const imageAnchor = $(`a[href="${href}"]`).first();
  return stripRatingPrefix(normalizeWhitespace(imageAnchor.find('img').attr('alt'))) || null;
};

const getAnchorImage = ($, href, baseUrl) => {
  const imageAnchor = $(`a[href="${href}"]`).first();
  return normalizeAsuraCoverUrl(baseUrl, imageAnchor.find('img').attr('src'));
};

const getHomeCards = (config, html, pageNum) => {
  const $ = load(html);
  const seenSeries = new Set();
  const mangas = [];

  $('a[href*="/comics/"][href*="/chapter/"]').each((_, el) => {
    const chapterHref = $(el).attr('href');
    const seriesPath = getSeriesPath(chapterHref);

    if (!seriesPath || seenSeries.has(seriesPath)) return;
    seenSeries.add(seriesPath);

    const chapterUrl = buildAbsoluteUrl(config.baseUrl, chapterHref);
    const sourceSlug = extractSlugFromUrl(buildAbsoluteUrl(config.baseUrl, seriesPath));
    const title =
      getAnchorText($, seriesPath) ||
      normalizeWhitespace(seriesPath.split('/').pop()?.replace(/-f\d+$/, '').replace(/-/g, ' ')) ||
      null;

    if (!chapterUrl || !sourceSlug || !title) return;

    const chapterMeta = buildChapterLabel($(el).text(), chapterUrl);

    mangas.push({
      source: config.name,
      sourceSlug,
      sourceUrl: buildAbsoluteUrl(config.baseUrl, seriesPath),
      title,
      altTitles: [],
      cover: getAnchorImage($, seriesPath, config.baseUrl),
      rating: null,
      latestChapter: chapterMeta.title,
      latestChapterNumber: chapterMeta.chapterNumber,
      chapterUrl,
      status: null,
      type: null,
    });
  });

  return {
    page: pageNum,
    totalPages: 1,
    mangas,
    mangaLength: mangas.length,
    lastUpdated: new Date().toISOString(),
  };
};

const parseSearch = (config, html) => {
  const $ = load(html);

  return $('#series-grid .series-card')
    .map((_, el) => {
      const element = $(el);
      const detailRelative = element.find('a[href^="/comics/"]').first().attr('href');
      const detailUrl = buildAbsoluteUrl(config.baseUrl, detailRelative);
      const sourceSlug = extractSlugFromUrl(detailUrl);

      if (!detailUrl || !sourceSlug) return null;

      const badges = element
        .find('span')
        .map((_, badge) => normalizeWhitespace($(badge).text()))
        .get()
        .filter(Boolean);

      const rating = badges.find((badge) => /^\d+(\.\d+)?$/.test(badge)) || null;
      const chapterCountMatch = normalizeWhitespace(element.text()).match(/\b\d+\s*(?:Chs\.|Chapters)\b/i);
      const chapterCount = chapterCountMatch ? chapterCountMatch[0].replace(/\s+/g, ' ') : null;
      const status =
        badges.find((badge) => /ongoing|completed|hiatus|dropped/i.test(badge)) || null;

      return {
        source: config.name,
        sourceSlug,
        sourceUrl: detailUrl,
        title: normalizeWhitespace(element.find('h3').first().text()),
        altTitles: [],
        cover: normalizeAsuraCoverUrl(config.baseUrl, element.find('img').first().attr('src')),
        rating,
        latestChapter: chapterCount,
        latestChapterNumber: extractChapterNumber(chapterCount || '', ''),
        chapterUrl: null,
        status,
        type: null,
      };
    })
    .get()
    .filter(Boolean);
};

const parseDetails = (config, html, sourceSlug) => {
  const $ = load(html);
  const comicSeries = getComicSeriesJsonLd($);
  const lockedChapterNumbers = extractLockedChapterNumbers(html);

  const title =
    comicSeries?.name ||
    normalizeWhitespace($('meta[property="og:title"]').attr('content')?.split('|')[0]) ||
    normalizeWhitespace($('title').text().split('|')[0]);

  if (!title) return null;

  const chapterAnchors = $(`a[href^="/comics/${sourceSlug}/chapter/"]`);
  const seenChapterUrls = new Set();
  const chapters = [];
  const buttonChapterUrls = [];

  chapterAnchors.each((_, el) => {
    const anchor = $(el);
    const chapterUrl = buildAbsoluteUrl(config.baseUrl, anchor.attr('href'));

    if (!chapterUrl || seenChapterUrls.has(chapterUrl)) return;
    seenChapterUrls.add(chapterUrl);

    const text = normalizeWhitespace(anchor.text());
    if (/^(first|latest) chapter$/i.test(text)) {
      buttonChapterUrls.push(chapterUrl);
      return;
    }

    const chapterMeta = buildChapterLabel(text, chapterUrl);
    if (
      chapterMeta.chapterNumber != null &&
      lockedChapterNumbers.has(chapterMeta.chapterNumber)
    ) {
      return;
    }

    chapters.push({
      title: chapterMeta.title || `Chapter ${chapterMeta.chapterNumber ?? ''}`.trim(),
      url: chapterUrl,
      chapterNumber: chapterMeta.chapterNumber,
      date: chapterMeta.date,
    });
  });

  for (const chapterUrl of buttonChapterUrls) {
    if (chapters.some((chapter) => chapter.url === chapterUrl)) continue;

    const chapterNumber = extractChapterNumber('', chapterUrl);
    if (chapterNumber != null && lockedChapterNumbers.has(chapterNumber)) continue;

    chapters.push({
      title: chapterNumber != null ? `Chapter ${chapterNumber}` : 'Chapter',
      url: chapterUrl,
      chapterNumber,
      date: null,
    });
  }

  chapters.sort((left, right) => {
    if (left.chapterNumber == null && right.chapterNumber == null) return 0;
    if (left.chapterNumber == null) return -1;
    if (right.chapterNumber == null) return 1;
    return left.chapterNumber - right.chapterNumber;
  });

  const altTitles = uniqueStrings(
    parseListText(
      Array.isArray(comicSeries?.alternateName)
        ? comicSeries.alternateName.join(', ')
        : comicSeries?.alternateName || ''
    )
  );

  const rank = matchSerializedNumber(html, 'popularityRank');

  return {
    source: config.name,
    sourceSlug,
    sourceUrl: buildAbsoluteUrl(config.baseUrl, `/comics/${sourceSlug}`),
    title,
    altTitles,
    cover: normalizeAsuraCoverUrl(
      config.baseUrl,
      comicSeries?.image ||
        $('meta[property="og:image"]').attr('content') ||
        $('img').first().attr('src')
    ),
    summary:
      comicSeries?.description ||
      normalizeWhitespace($('meta[name="description"]').attr('content')) ||
      null,
    ratingValue:
      comicSeries?.aggregateRating?.ratingValue?.toString() ||
      normalizeWhitespace(matchSerializedString(html, 'rating')) ||
      null,
    rankLine: rank ? `#${rank}` : null,
    status: normalizeWhitespace(matchSerializedString(html, 'status')) || null,
    type: normalizeWhitespace(matchSerializedString(html, 'type')) || null,
    genres: Array.isArray(comicSeries?.genre)
      ? comicSeries.genre.map((genre) => normalizeWhitespace(genre)).filter(Boolean)
      : [],
    authors: comicSeries?.author?.name ? [normalizeWhitespace(comicSeries.author.name)] : [],
    artists: comicSeries?.illustrator?.name
      ? [normalizeWhitespace(comicSeries.illustrator.name)]
      : [],
    chapters,
    lastUpdated: new Date().toISOString(),
  };
};

const parseChapter = (config, html, chapterUrl) => {
  const $ = load(html);

  const rawImages = html.match(/https:\/\/cdn\.asurascans\.com\/asura-images\/chapters\/[^"&\\]+/g) || [];
  const images = uniqueStrings(rawImages.map((url) => decodeHtml(url)));
  const readableImages = images.length > 1 ? images.slice(1) : images;

  if (readableImages.length === 0) return null;

  const chapterName = matchSerializedString(html, 'chapterName');
  const chapterTitle = matchSerializedString(html, 'chapterTitle');
  const heading = [chapterName ? `Chapter ${chapterName}` : null, chapterTitle]
    .filter(Boolean)
    .join(' - ');

  return {
    source: config.name,
    chapterUrl,
    title:
      heading ||
      normalizeWhitespace($('title').text().replace(/\s*-\s*Read Online.*$/i, '')) ||
      null,
    images: readableImages,
    prevChapterUrl: buildAbsoluteUrl(config.baseUrl, $('link[rel="prev"]').attr('href')),
    nextChapterUrl: buildAbsoluteUrl(config.baseUrl, $('link[rel="next"]').attr('href')),
    lastUpdated: new Date().toISOString(),
  };
};

export const createAsuraSource = (config) => ({
  name: config.name,
  label: config.label,
  baseUrl: config.baseUrl,
  matchesUrl(url) {
    try {
      const host = new URL(url).hostname;
      return host === new URL(config.baseUrl).hostname;
    } catch {
      return false;
    }
  },
  async getHome(page = 1) {
    if (page !== 1) {
      return {
        page,
        totalPages: 1,
        mangas: [],
        mangaLength: 0,
        lastUpdated: new Date().toISOString(),
      };
    }

    const html = await fetchHtml(`${config.baseUrl}/`, {
      referer: `${config.baseUrl}/`,
    });
    return getHomeCards(config, html, page);
  },
  async search(query) {
    const html = await fetchHtml(`${config.baseUrl}/browse?search=${encodeURIComponent(query)}`, {
      referer: `${config.baseUrl}/browse`,
    });
    return parseSearch(config, html);
  },
  async getDetails(sourceSlug) {
    const html = await fetchHtml(`${config.baseUrl}/comics/${sourceSlug}`, {
      referer: `${config.baseUrl}/browse`,
    });
    return parseDetails(config, html, sourceSlug);
  },
  async getChapter(url) {
    const html = await fetchHtml(url, {
      referer: `${config.baseUrl}/`,
    });
    return parseChapter(config, html, url);
  },
});
