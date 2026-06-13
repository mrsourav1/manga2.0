// src/config/constants.js
export const USER_AGENTS = [
  // Desktop - Windows (Chrome / Edge / Firefox)
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",

  // Desktop - macOS (Safari / Chrome / Firefox)
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13.0; rv:124.0) Gecko/20100101 Firefox/124.0",

  // Desktop - Linux
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0",

  // Mobile - Android Chrome (various devices)
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-G9900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11; Redmi Note 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.87 Mobile Safari/537.36",

  // Mobile - Samsung Internet
  "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/20.0 Chrome/110.0.5481.153 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/17.0 Chrome/94.0.4606.71 Mobile Safari/537.36",

  // Mobile - Firefox for Android
  "Mozilla/5.0 (Android 13; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0",
  "Mozilla/5.0 (Android 12; Mobile; rv:115.0) Gecko/20100101 Firefox/115.0",

  // Mobile - Opera / Opera Mini
  "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 OPR/82.1.4228.0",
  "Opera/9.80 (Android; Opera Mini/36.2.2254/200.507; U; en) Presto/2.12.423 Version/12.16",

  // iPhone / iPad - Safari (iOS)
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",

  // Android WebView / Chrome WebView
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12; SM-A125M) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.5845.99 Mobile Safari/537.36",

  // Tablet - Android / iPad
  "Mozilla/5.0 (Linux; Android 13; Pixel C) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",

  // Old(er) but still seen in the wild (compatibility)
  "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36",

  // Other browsers / niche
  "Mozilla/5.0 (X11; CrOS x86_64 15021.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Vivaldi/6.0.2970.26 Chrome/110.0.5481.178 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Brave/1.59.122 Chrome/125.0.0.0 Safari/537.36",

  // Smart TV / Consoles (occasionally useful for broadening fingerprints)
  "Mozilla/5.0 (Linux; U; Android 9; en-us; AFTN Build/PS7270) AppleWebKit/537.36 (KHTML, like Gecko) Silk/88.4.13 like Chrome/88.0.4324.152 Safari/537.36",
  "Mozilla/5.0 (PlayStation 4 3.11) AppleWebKit/537.73 (KHTML, like Gecko)",

  // Misc mobile variants
  "Mozilla/5.0 (Linux; Android 11; SM-A107F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.5414.87 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 10; SM-N975U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.105 Mobile Safari/537.36",

  // Regional / localized examples
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0 (en-US)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.140 Safari/537.36 (x86_64)",

  // Fallback generic modern UA
  "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)",

  // A few extra mobile UA variants
  "Mozilla/5.0 (Linux; Android 12; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.90 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1"
];

const envNumber = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const CACHE_TTL = 24 * 60 * 60;
export const HOME_CACHE_TTL = envNumber('HOME_CACHE_TTL_SECONDS', 24 * 60 * 60);
export const DETAILS_CACHE_TTL = envNumber('DETAILS_CACHE_TTL_SECONDS', 24 * 60 * 60);
export const CHAPTER_CACHE_TTL = envNumber('CHAPTER_CACHE_TTL_SECONDS', 24 * 60 * 60);
export const SEARCH_CACHE_TTL = envNumber('SEARCH_CACHE_TTL_SECONDS', 24 * 60 * 60);
export const PREFETCH_PAGES = envNumber('HOMEPAGE_PREFETCH_PAGES', 3);
export const PREFETCH_INTERVAL_MS = envNumber('PREFETCH_INTERVAL_MS', 24 * 60 * 60 * 1000);
export const REQUEST_TIMEOUT_MS = envNumber('REQUEST_TIMEOUT_MS', 30000);
export const SEARCH_SOURCE_TIMEOUT_MS = envNumber('SEARCH_SOURCE_TIMEOUT_MS', 8000);

export const SOURCE_PRIORITY = ['asura', 'manhuaplus', 'manhuaus', 'mangabuddy'];

export const SOURCE_CONFIGS = {
  asura: {
    name: 'asura',
    label: 'Asura Scans',
    baseUrl: process.env.ASURA_BASE_URL || 'https://asurascans.com',
    adapter: 'asura',
  },
  manhuaplus: {
    name: 'manhuaplus',
    label: 'ManhuaPlus',
    baseUrl: process.env.MANHUAPLUS_BASE_URL || 'https://manhuaplus.com',
    adapter: 'madara',
  },
  manhuaus: {
    name: 'manhuaus',
    label: 'ManhuaUS',
    baseUrl: process.env.MANHUAUS_BASE_URL || 'https://manhuaus.com',
    adapter: 'madara',
    insecureHTTPS: true,
  },
  mangabuddy: {
    name: 'mangabuddy',
    label: 'MangaBuddy',
    baseUrl: process.env.MANGABUDDY_BASE_URL || 'https://mangabuddy.com',
    adapter: 'mangabuddy',
  },
};

export const SUPPORTED_SOURCE_NAMES = Object.keys(SOURCE_CONFIGS);
