import axios from 'axios';
import { REQUEST_TIMEOUT_MS } from '../config/constants.js';
import { getRandomUserAgent } from './scraper.js';

const IMAGE_PROXY_TARGETS = [
  {
    hostPattern: /(^|\.)asurascans\.com$/i,
    referer: 'https://asurascans.com/',
  },
  {
    hostPattern: /(^|\.)manhuaus\.com$/i,
    referer: 'https://manhuaus.com/',
  },
  {
    hostPattern: /(^|\.)mbbcdn\.com$/i,
    referer: 'https://mangabuddy.com/',
  },
  {
    hostPattern: /(^|\.)manhuaplus\.com$/i,
    referer: 'https://manhuaplus.com/',
  },
];

const getTargetConfig = (url) => {
  try {
    const parsed = new URL(url);
    return (
      IMAGE_PROXY_TARGETS.find((target) => target.hostPattern.test(parsed.hostname)) || null
    );
  } catch {
    return null;
  }
};

export const isSupportedProxyImageUrl = (url) => Boolean(getTargetConfig(url));

export const fetchProxyImage = async (url) => {
  const target = getTargetConfig(url);
  if (!target) {
    return null;
  }

  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    responseType: 'arraybuffer',
    headers: {
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: target.referer,
      'User-Agent': getRandomUserAgent(),
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  return {
    body: Buffer.from(response.data),
    contentType: response.headers['content-type'] || 'application/octet-stream',
    cacheControl: response.headers['cache-control'] || 'public, max-age=86400',
  };
};
