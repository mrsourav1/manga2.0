const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/+$/, '') || '';

const isProxyRequiredHost = (hostname: string) =>
  /(^|\.)manhuaus\.com$/i.test(hostname) ||
  /(^|\.)mbbcdn\.com$/i.test(hostname) ||
  /(^|\.)asurascans\.com$/i.test(hostname) ||
  /(^|\.)manhuaplus\.com$/i.test(hostname);

const toProxyUrl = (uri: string) =>
  backendUrl ? `${backendUrl}/api/manga/cover?url=${encodeURIComponent(uri)}` : uri;

export const getOriginalImageUri = (uri: string | null) => {
  if (!uri) return null;

  try {
    const parsed = new URL(uri);
    return isProxyRequiredHost(parsed.hostname) ? toProxyUrl(uri) : uri;
  } catch {
    return uri;
  }
};

export const getCardImageUri = (uri: string | null) => {
  if (!uri) return null;

  let nextUri = uri;

  if (nextUri.includes('cdn.asurascans.com/asura-images/covers/')) {
    if (!/-\d+\.(gif|jpe?g|png|webp)(?:$|[?#])/i.test(nextUri)) {
      nextUri = nextUri.replace(/\.(gif|jpe?g|png|webp)(?=$|[?#])/i, '-400.$1');
    }
  } else if (/manhuaplus\.com/i.test(nextUri)) {
    if (!/-\d+x\d+\.(gif|jpe?g|png|webp)(?:$|[?#])/i.test(nextUri)) {
      nextUri = nextUri.replace(/\.(gif|jpe?g|png|webp)(?=$|[?#])/i, '-175x238.$1');
    }
  }

  return getOriginalImageUri(nextUri);
};

export const getDetailImageUri = (uri: string | null) => {
  if (!uri) return null;

  let nextUri = uri;

  if (nextUri.includes('cdn.asurascans.com/asura-images/covers/')) {
    if (!/-\d+\.(gif|jpe?g|png|webp)(?:$|[?#])/i.test(nextUri)) {
      nextUri = nextUri.replace(/\.(gif|jpe?g|png|webp)(?=$|[?#])/i, '-400.$1');
    }
  }

  return getOriginalImageUri(nextUri);
};

export const getReaderImageUri = (uri: string | null) => getOriginalImageUri(uri);
