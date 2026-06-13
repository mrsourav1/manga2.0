import { load } from 'cheerio';
import {
  buildAbsoluteUrl,
  extractChapterNumber,
  extractSlugFromUrl,
  fetchHtml,
  isProbablyBlockedDocument,
  normalizeWhitespace,
  parseListText,
  uniqueStrings,
} from '../scraper.js';

const normalizeMadaraCoverUrl = (baseUrl, url) => {
  const absoluteUrl = buildAbsoluteUrl(baseUrl, url);
  if (!absoluteUrl) return null;

  return absoluteUrl.replace(
    /-\d+x\d+(?=\.(?:gif|jpe?g|png|webp)(?:$|[?#]))/i,
    ''
  );
};

const extractMadaraPageNumber = (href = '') => {
  const match = href.match(/\/page\/(\d+)\/?$/i);
  return match ? Number.parseInt(match[1], 10) : null;
};

const getMadaraTotalPages = ($, pageNum) => {
  const totalPagesText = normalizeWhitespace($('.wp-pagenavi .pages').text());
  const totalPagesMatch = totalPagesText.match(/Page \d+ of (\d+)/i);

  if (totalPagesMatch) {
    return Number.parseInt(totalPagesMatch[1], 10);
  }

  const lastPageHref =
    $('.wp-pagenavi a.last').first().attr('href') ||
    $('.wp-pagenavi a[aria-label*="Last Page"]').first().attr('href') ||
    '';
  const lastPage = extractMadaraPageNumber(lastPageHref);

  if (lastPage) {
    return lastPage;
  }

  const visiblePageNumbers = $('.wp-pagenavi a.page, .wp-pagenavi span.current')
    .map((_, el) => Number.parseInt(normalizeWhitespace($(el).text()), 10))
    .get()
    .filter((value) => Number.isFinite(value));

  if (visiblePageNumbers.length > 0) {
    const maxVisiblePage = Math.max(...visiblePageNumbers);
    return $('.wp-pagenavi a.nextpostslink').length > 0
      ? Math.max(maxVisiblePage, pageNum + 1)
      : maxVisiblePage;
  }

  return Math.max(1, pageNum);
};

const getSummaryValue = ($, heading) => {
  const target = heading.toLowerCase();

  const item = $('.post-content_item').filter((_, el) =>
    normalizeWhitespace($(el).find('.summary-heading').text()).toLowerCase().includes(target)
  );

  if (!item.length) return null;

  const links = item
    .find('.summary-content a')
    .map((_, link) => normalizeWhitespace($(link).text()))
    .get()
    .filter(Boolean);

  if (links.length > 0) {
    return uniqueStrings(links);
  }

  const text = normalizeWhitespace(item.find('.summary-content').text());
  return text || null;
};

const parseHome = (config, html, pageNum) => {
  const $ = load(html);
  if (isProbablyBlockedDocument($)) return null;

  const mangas = $('.page-item-detail')
    .map((_, el) => {
      const element = $(el);
      const detailUrl = buildAbsoluteUrl(
        config.baseUrl,
        element.find('.post-title a').attr('href') || element.find('.item-thumb a').attr('href')
      );
      const sourceSlug = extractSlugFromUrl(detailUrl);
      const chapterAnchor = element.find('.chapter-item a').first();

      if (!detailUrl || !sourceSlug) return null;

      return {
        source: config.name,
        sourceSlug,
        sourceUrl: detailUrl,
        title: normalizeWhitespace(element.find('.post-title a').text()),
        altTitles: [],
        cover: normalizeMadaraCoverUrl(
          config.baseUrl,
          element.find('img').attr('data-src') || element.find('img').attr('src')
        ),
        rating: normalizeWhitespace(element.find('.score').first().text()) || null,
        latestChapter: normalizeWhitespace(chapterAnchor.text()) || null,
        latestChapterNumber: extractChapterNumber(chapterAnchor.text(), chapterAnchor.attr('href')),
        chapterUrl: buildAbsoluteUrl(config.baseUrl, chapterAnchor.attr('href')),
        status: null,
        type: null,
      };
    })
    .get()
    .filter(Boolean);

  if (mangas.length === 0) return null;

  const totalPages = getMadaraTotalPages($, pageNum);

  return {
    page: pageNum,
    totalPages,
    mangas,
    mangaLength: mangas.length,
    lastUpdated: new Date().toISOString(),
  };
};

const parseSearch = (config, html) => {
  const $ = load(html);
  if (isProbablyBlockedDocument($)) return [];

  return $('.c-tabs-item__content')
    .map((_, el) => {
      const element = $(el);
      const detailUrl = buildAbsoluteUrl(config.baseUrl, element.find('.post-title a').attr('href'));
      const sourceSlug = extractSlugFromUrl(detailUrl);
      const latestChapterAnchor = element.find('.latest-chap .chapter a').first();
      const altTitles = parseListText(
        normalizeWhitespace(element.find('.mg_alternative .summary-content').text())
      );
      const genres = uniqueStrings(
        element
          .find('.mg_genres .summary-content a')
          .map((_, genre) => normalizeWhitespace($(genre).text()))
          .get()
      );

      if (!detailUrl || !sourceSlug) return null;

      return {
        source: config.name,
        sourceSlug,
        sourceUrl: detailUrl,
        title: normalizeWhitespace(element.find('.post-title a').text()),
        altTitles,
        cover: normalizeMadaraCoverUrl(
          config.baseUrl,
          element.find('img').attr('data-src') || element.find('img').attr('src')
        ),
        rating: null,
        latestChapter: normalizeWhitespace(latestChapterAnchor.text()) || null,
        latestChapterNumber: extractChapterNumber(
          latestChapterAnchor.text(),
          latestChapterAnchor.attr('href')
        ),
        chapterUrl: buildAbsoluteUrl(config.baseUrl, latestChapterAnchor.attr('href')),
        status: normalizeWhitespace(element.find('.mg_status .summary-content').text()) || null,
        type: null,
        genres,
      };
    })
    .get()
    .filter(Boolean);
};

const parseDetails = (config, html, sourceSlug) => {
  const $ = load(html);
  if (isProbablyBlockedDocument($)) return null;

  const chapters = [];
  const chapterUrls = new Set();

  $('.wp-manga-chapter').each((_, el) => {
    const chapterElement = $(el);
    const anchor = chapterElement.find('a').first();
    const chapterUrl = buildAbsoluteUrl(config.baseUrl, anchor.attr('href'));

    if (!chapterUrl || chapterUrls.has(chapterUrl)) return;
    chapterUrls.add(chapterUrl);

    const title = normalizeWhitespace(anchor.text());

    chapters.push({
      title,
      url: chapterUrl,
      chapterNumber: extractChapterNumber(title, chapterUrl),
      date: normalizeWhitespace(chapterElement.find('.chapter-release-date').text()) || null,
    });
  });

  chapters.sort((left, right) => {
    if (left.chapterNumber == null && right.chapterNumber == null) return 0;
    if (left.chapterNumber == null) return -1;
    if (right.chapterNumber == null) return 1;
    return left.chapterNumber - right.chapterNumber;
  });

  const title = normalizeWhitespace($('div.post-title h1').first().text());
  if (!title) return null;

  const summaryParagraphs = $('.summary__content p')
    .map((_, paragraph) => normalizeWhitespace($(paragraph).text()))
    .get()
    .filter(Boolean);

  return {
    source: config.name,
    sourceSlug,
    sourceUrl: buildAbsoluteUrl(config.baseUrl, `/manga/${sourceSlug}/`),
    title,
    altTitles: parseListText(
      Array.isArray(getSummaryValue($, 'alternative'))
        ? getSummaryValue($, 'alternative').join(', ')
        : getSummaryValue($, 'alternative') || ''
    ),
    cover: normalizeMadaraCoverUrl(
      config.baseUrl,
      $('.summary_image img').attr('data-src') || $('.summary_image img').attr('src')
    ),
    summary:
      summaryParagraphs.join('\n\n') || normalizeWhitespace($('.summary__content').first().text()) || null,
    ratingValue: normalizeWhitespace($('.post-total-rating .score').first().text()) || null,
    rankLine: normalizeWhitespace(
      Array.isArray(getSummaryValue($, 'rank')) ? getSummaryValue($, 'rank').join(', ') : getSummaryValue($, 'rank') || ''
    ) || null,
    status: normalizeWhitespace(
      Array.isArray(getSummaryValue($, 'status'))
        ? getSummaryValue($, 'status').join(', ')
        : getSummaryValue($, 'status') || ''
    ) || null,
    type: normalizeWhitespace(
      Array.isArray(getSummaryValue($, 'type'))
        ? getSummaryValue($, 'type').join(', ')
        : getSummaryValue($, 'type') || ''
    ) || null,
    genres: Array.isArray(getSummaryValue($, 'genres'))
      ? getSummaryValue($, 'genres')
      : parseListText(getSummaryValue($, 'genres') || ''),
    authors: Array.isArray(getSummaryValue($, 'author'))
      ? getSummaryValue($, 'author')
      : parseListText(getSummaryValue($, 'author') || ''),
    artists: Array.isArray(getSummaryValue($, 'artist'))
      ? getSummaryValue($, 'artist')
      : parseListText(getSummaryValue($, 'artist') || ''),
    chapters,
    lastUpdated: new Date().toISOString(),
  };
};

const parseChapter = (config, html, chapterUrl) => {
  const $ = load(html);
  if (isProbablyBlockedDocument($)) return null;

  const images = $('.reading-content img')
    .map((_, el) => {
      const imageUrl = buildAbsoluteUrl(
        config.baseUrl,
        $(el).attr('data-src') || $(el).attr('src')
      );
      return imageUrl ? imageUrl.trim() : null;
    })
    .get()
    .filter(Boolean);

  if (images.length === 0) return null;

  return {
    source: config.name,
    chapterUrl,
    title:
      normalizeWhitespace($('.entry-title').first().text()) ||
      normalizeWhitespace($('title').first().text()) ||
      null,
    images,
    prevChapterUrl: buildAbsoluteUrl(config.baseUrl, $('.nav-previous a').attr('href')),
    nextChapterUrl: buildAbsoluteUrl(config.baseUrl, $('.nav-next a').attr('href')),
    lastUpdated: new Date().toISOString(),
  };
};

export const createMadaraSource = (config) => ({
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
    const html = await fetchHtml(`${config.baseUrl}/page/${page}/`, {
      referer: `${config.baseUrl}/`,
      insecureHTTPS: config.insecureHTTPS,
    });
    return parseHome(config, html, page);
  },
  async search(query) {
    const searchUrl = `${config.baseUrl}/?s=${encodeURIComponent(query)}&post_type=wp-manga`;
    const html = await fetchHtml(searchUrl, {
      referer: `${config.baseUrl}/`,
      insecureHTTPS: config.insecureHTTPS,
    });
    return parseSearch(config, html);
  },
  async getDetails(sourceSlug) {
    const html = await fetchHtml(`${config.baseUrl}/manga/${sourceSlug}/`, {
      referer: `${config.baseUrl}/`,
      insecureHTTPS: config.insecureHTTPS,
    });
    return parseDetails(config, html, sourceSlug);
  },
  async getChapter(url) {
    const html = await fetchHtml(url, {
      referer: `${config.baseUrl}/`,
      insecureHTTPS: config.insecureHTTPS,
    });
    return parseChapter(config, html, url);
  },
});
