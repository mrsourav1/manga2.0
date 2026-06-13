import { load } from 'cheerio';
import {
  buildAbsoluteUrl,
  extractChapterNumber,
  extractSlugFromUrl,
  fetchHtml,
  normalizeWhitespace,
  parseListText,
  uniqueStrings,
} from '../scraper.js';

const chapterPagePattern = /\/latest\?page=(\d+)/i;

const extractPageNumber = (href = '') => {
  const match = href.match(chapterPagePattern);
  return match ? Number.parseInt(match[1], 10) : null;
};

const normalizeCoverUrl = (baseUrl, value) => buildAbsoluteUrl(baseUrl, value);

const getSearchMetaSpans = ($, element) =>
  $(element)
    .find('.name')
    .children('span')
    .map((_, span) => normalizeWhitespace($(span).text()))
    .get()
    .filter(Boolean);

const getMetaParagraph = ($, label) =>
  $('.book-info .detail .meta p').filter((_, el) =>
    normalizeWhitespace($(el).find('strong').text())
      .toLowerCase()
      .startsWith(`${label.toLowerCase()} :`)
  );

const getMetaAnchorValues = ($, label) =>
  getMetaParagraph($, label)
    .find('a')
    .map((_, el) => normalizeWhitespace($(el).text()).replace(/\s*,\s*$/, ''))
    .get()
    .filter(Boolean);

const getMetaTextValue = ($, label) => {
  const paragraph = getMetaParagraph($, label).first();
  if (!paragraph.length) return null;

  const clone = paragraph.clone();
  clone.find('strong').remove();
  return normalizeWhitespace(clone.text()).replace(/^:\s*/, '') || null;
};

const getTotalPages = ($, pageNum) => {
  const pageNumbers = uniqueStrings(
    [
      ...$('.btn.link[href*="/latest?page="]')
        .map((_, el) => $(el).attr('href'))
        .get(),
      ...$('select option[value*="/latest?page="]')
        .map((_, el) => $(el).attr('value'))
        .get(),
    ]
  )
    .map((href) => extractPageNumber(href))
    .filter((value) => Number.isFinite(value));

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : Math.max(1, pageNum);
};

const parseHome = (config, html, pageNum) => {
  const $ = load(html);

  const mangas = $('.book-item')
    .map((_, el) => {
      const element = $(el);
      const detailUrl = buildAbsoluteUrl(
        config.baseUrl,
        element.find('.thumb a').first().attr('href')
      );
      const sourceSlug = extractSlugFromUrl(detailUrl);

      if (!detailUrl || !sourceSlug) return null;

      const latestChapter = normalizeWhitespace(element.find('.latest-chapter').first().text()) || null;

      return {
        source: config.name,
        sourceSlug,
        sourceUrl: detailUrl,
        title:
          normalizeWhitespace(element.find('.thumb a').first().attr('title')) ||
          normalizeWhitespace(element.find('a[title]').last().text()) ||
          null,
        altTitles: [],
        cover: normalizeCoverUrl(
          config.baseUrl,
          element.find('img').attr('data-src') || element.find('img').attr('src')
        ),
        rating: null,
        latestChapter,
        latestChapterNumber: extractChapterNumber(latestChapter || '', ''),
        chapterUrl: null,
        status: null,
        type: null,
      };
    })
    .get()
    .filter(Boolean);

  if (mangas.length === 0) return null;

  return {
    page: pageNum,
    totalPages: getTotalPages($, pageNum),
    mangas,
    mangaLength: mangas.length,
    lastUpdated: new Date().toISOString(),
  };
};

const parseSearch = (config, html) => {
  const $ = load(html);

  return $('.novel__item')
    .map((_, el) => {
      const element = $(el);
      const detailUrl = buildAbsoluteUrl(config.baseUrl, element.find('h3 a').attr('href'));
      const sourceSlug = extractSlugFromUrl(detailUrl);

      if (!detailUrl || !sourceSlug) return null;

      const metaSpans = getSearchMetaSpans($, element);
      const latestChapter =
        metaSpans.find((value) => /chapter|vol\.|episode|side\./i.test(value)) || null;
      const altTitles = metaSpans.filter((value) => value !== latestChapter);

      return {
        source: config.name,
        sourceSlug,
        sourceUrl: detailUrl,
        title: normalizeWhitespace(element.find('h3 a').text()) || null,
        altTitles: parseListText(altTitles.join(', ')),
        cover: normalizeCoverUrl(config.baseUrl, element.find('img').attr('src')),
        rating: null,
        latestChapter,
        latestChapterNumber: extractChapterNumber(latestChapter || '', ''),
        chapterUrl: null,
        status: null,
        type: null,
      };
    })
    .get()
    .filter(Boolean);
};

const extractBookId = (html = '') => {
  const match = html.match(/var\s+bookId\s*=\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : null;
};

const extractChapterDates = ($, config) => {
  const dateByUrl = new Map();

  $('#chapter-list li').each((_, el) => {
    const chapterUrl = buildAbsoluteUrl(config.baseUrl, $(el).find('a').attr('href'));
    const date = normalizeWhitespace($(el).find('.chapter-update').text()) || null;

    if (chapterUrl && date) {
      dateByUrl.set(chapterUrl, date);
    }
  });

  return dateByUrl;
};

const parseSummary = ($) => {
  const paragraphs = $('.summary p')
    .map((_, el) => normalizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  const contentParagraph =
    paragraphs.find((text) => !/^You are reading\b/i.test(text)) ||
    paragraphs[paragraphs.length - 1] ||
    null;

  return contentParagraph || null;
};

const fetchChaptersHtml = async (config, detailUrl, bookId) =>
  fetchHtml(`${config.baseUrl}/api/manga/${bookId}/chapters`, {
    referer: detailUrl,
  });

const parseChaptersFromApi = (config, html, dateByUrl) => {
  const $ = load(html);

  return $('option')
    .map((_, el) => {
      const chapterUrl = buildAbsoluteUrl(config.baseUrl, $(el).attr('value'));
      const title = normalizeWhitespace($(el).text());
      const chapterNumber = extractChapterNumber(title, chapterUrl || '');

      if (!chapterUrl || !title || chapterNumber == null) return null;

      return {
        title,
        url: chapterUrl,
        chapterNumber,
        date: dateByUrl.get(chapterUrl) || null,
      };
    })
    .get()
    .filter(Boolean);
};

const parseChaptersFromDetails = (config, $, dateByUrl) =>
  $('#chapter-list li a')
    .map((_, el) => {
      const chapterUrl = buildAbsoluteUrl(config.baseUrl, $(el).attr('href'));
      const title = normalizeWhitespace($(el).find('.chapter-title').text()) || normalizeWhitespace($(el).text());

      if (!chapterUrl || !title) return null;

      return {
        title,
        url: chapterUrl,
        chapterNumber: extractChapterNumber(title, chapterUrl),
        date: dateByUrl.get(chapterUrl) || null,
      };
    })
    .get()
    .filter(Boolean);

const sortChapters = (chapters) =>
  [...chapters].sort((left, right) => {
    if (left.chapterNumber == null && right.chapterNumber == null) return 0;
    if (left.chapterNumber == null) return -1;
    if (right.chapterNumber == null) return 1;
    return left.chapterNumber - right.chapterNumber;
  });

const parseDetails = async (config, html, sourceSlug) => {
  const $ = load(html);
  const title = normalizeWhitespace($('.book-info .detail .name h1').first().text());

  if (!title) return null;

  const detailUrl = buildAbsoluteUrl(config.baseUrl, `/${sourceSlug}`);
  const altTitles = uniqueStrings(
    $('.book-info .detail .name h2')
      .first()
      .text()
      .split('/')
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)
  );

  const dateByUrl = extractChapterDates($, config);
  const bookId = extractBookId(html);

  let chapters = parseChaptersFromDetails(config, $, dateByUrl);

  if (bookId) {
    try {
      const chaptersHtml = await fetchChaptersHtml(config, detailUrl, bookId);
      const apiChapters = parseChaptersFromApi(config, chaptersHtml, dateByUrl);

      if (apiChapters.length > 0) {
        chapters = apiChapters;
      }
    } catch {
      // Fall back to the initial detail page list when the API list is unavailable.
    }
  }

  return {
    source: config.name,
    sourceSlug,
    sourceUrl: detailUrl,
    title,
    altTitles,
    cover: normalizeCoverUrl(
      config.baseUrl,
      $('.book-info .img-cover img').attr('data-src') || $('.book-info .img-cover img').attr('src')
    ),
    summary: parseSummary($),
    ratingValue: null,
    rankLine: null,
    status: getMetaAnchorValues($, 'Status')[0] || getMetaTextValue($, 'Status'),
    type: null,
    genres: uniqueStrings(getMetaAnchorValues($, 'Genres')),
    authors: uniqueStrings(getMetaAnchorValues($, 'Authors')),
    artists: [],
    chapters: sortChapters(chapters),
    lastUpdated: new Date().toISOString(),
  };
};

const extractChapterImages = (html = '') => {
  const match = html.match(/var\s+chapImages\s*=\s*'([^']+)'/i);
  if (!match) return [];

  return uniqueStrings(
    match[1]
      .split(',')
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean)
  );
};

const normalizeNavUrl = (baseUrl, value) => {
  if (!value || value === '#' || /^javascript:/i.test(value)) return null;
  return buildAbsoluteUrl(baseUrl, value);
};

const parseChapter = (config, html, chapterUrl) => {
  const $ = load(html);

  const images = extractChapterImages(html);
  if (images.length === 0) {
    images.push(
      ...$('.chapter-image img')
        .map((_, el) => buildAbsoluteUrl(config.baseUrl, $(el).attr('data-src') || $(el).attr('src')))
        .get()
        .filter(Boolean)
    );
  }

  if (images.length === 0) return null;

  return {
    source: config.name,
    chapterUrl,
    title:
      normalizeWhitespace($('.chapter-info h1').first().text()) ||
      normalizeWhitespace($('title').first().text().replace(/\|\s*MangaBuddy$/i, '')) ||
      null,
    images: uniqueStrings(images),
    prevChapterUrl: normalizeNavUrl(config.baseUrl, $('#btn-prev').attr('href')),
    nextChapterUrl: normalizeNavUrl(config.baseUrl, $('#btn-next').attr('href')),
    lastUpdated: new Date().toISOString(),
  };
};

export const createMangaBuddySource = (config) => ({
  name: config.name,
  label: config.label,
  baseUrl: config.baseUrl,
  matchesUrl(url) {
    try {
      return new URL(url).hostname === new URL(config.baseUrl).hostname;
    } catch {
      return false;
    }
  },
  async getHome(page = 1) {
    const html = await fetchHtml(`${config.baseUrl}/latest?page=${page}`, {
      referer: `${config.baseUrl}/latest`,
    });
    return parseHome(config, html, page);
  },
  async search(query) {
    const html = await fetchHtml(
      `${config.baseUrl}/api/manga/search?q=${encodeURIComponent(query)}`,
      {
        referer: `${config.baseUrl}/search?q=${encodeURIComponent(query)}`,
      }
    );
    return parseSearch(config, html);
  },
  async getDetails(sourceSlug) {
    const html = await fetchHtml(`${config.baseUrl}/${sourceSlug}`, {
      referer: `${config.baseUrl}/latest`,
    });
    return parseDetails(config, html, sourceSlug);
  },
  async getChapter(url) {
    const html = await fetchHtml(url, {
      referer: `${config.baseUrl}/latest`,
    });
    return parseChapter(config, html, url);
  },
});
