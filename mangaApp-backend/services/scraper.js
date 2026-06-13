import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import {
  REQUEST_TIMEOUT_MS,
  USER_AGENTS,
} from '../config/constants.js';

export const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

export const normalizeWhitespace = (value = '') => value.replace(/\s+/g, ' ').trim();

export const uniqueStrings = (values = []) => {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
};

export const buildAbsoluteUrl = (baseUrl, input) => {
  if (!input) return null;

  try {
    return new URL(input, baseUrl).toString();
  } catch {
    return null;
  }
};

export const extractSlugFromUrl = (url) => {
  if (!url) return null;

  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '');
    const segments = pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] || null;
  } catch {
    return null;
  }
};

export const parseListText = (value = '') =>
  uniqueStrings(
    value
      .split(/[\n,|]|•/g)
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean)
  );

export const normalizeTitle = (title = '') =>
  normalizeWhitespace(
    title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
  );

export const extractChapterNumber = (text = '', url = '') => {
  const combined = `${text} ${url}`;
  const chapterMatch = combined.match(/chapter(?:\s*|-)?(\d+(?:\.\d+)?)/i);

  if (chapterMatch) {
    return Number.parseFloat(chapterMatch[1]);
  }

  const trailingNumberMatch = url.match(/\/(\d+(?:\.\d+)?)\/?$/);
  if (trailingNumberMatch) {
    return Number.parseFloat(trailingNumberMatch[1]);
  }

  return null;
};

export const getJsonLdObjects = ($) =>
  $('script[type="application/ld+json"]')
    .map((_, el) => {
      try {
        return JSON.parse($(el).contents().text().trim());
      } catch {
        return null;
      }
    })
    .get()
    .filter(Boolean);

export const isProbablyBlockedDocument = (input) => {
  const $ = typeof input === 'string' ? load(input) : input;
  const title = $('title').text().toLowerCase();
  return (
    title.includes('attention required') ||
    title.includes('just a moment') ||
    title.includes('access denied') ||
    title.includes('web filter block override') ||
    $('form#challenge-form').length > 0
  );
};

export const fetchHtml = async (
  url,
  {
    timeout = REQUEST_TIMEOUT_MS,
    headers = {},
    referer,
    insecureHTTPS = false,
  } = {}
) => {
  const response = await axios.get(url, {
    timeout,
    responseType: 'text',
    httpsAgent: insecureHTTPS ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': getRandomUserAgent(),
      ...(referer ? { Referer: referer } : {}),
      ...headers,
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  return response.data;
};
