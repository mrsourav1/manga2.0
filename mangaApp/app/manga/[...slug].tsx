import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useLibrary } from '../../context/LibraryContext';
import type { LibraryMangaSnapshot } from '../../services/libraryDatabase';
import { getReaderImageUri } from '../../services/imageUrls';
import { extractChapterNumber } from '../../services/librarySnapshots';
import { getChapter } from '../../services/mangaServices';

type ChapterResponse = {
  title: string | null;
  images: string[];
  prevChapterUrl: string | null;
  nextChapterUrl: string | null;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildReaderHtml = (imageUrls: string[]) => {
  const images = imageUrls
    .map(
      (uri, index) => `
        <figure class="page">
          <img
            src="${escapeHtml(uri)}"
            alt="Chapter page ${index + 1}"
            loading="eager"
            decoding="async"
          />
        </figure>
      `
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover"
      />
      <title>Chapter Reader</title>
      <style>
        :root {
          color-scheme: dark;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #05070b;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          overflow-x: hidden;
        }

        body {
          min-height: 100vh;
          -webkit-text-size-adjust: none;
        }

        .reader {
          padding: 0 0 16px;
        }

        .page {
          margin: 0;
          padding: 0;
          line-height: 0;
          font-size: 0;
        }

        img {
          display: block;
          width: 100%;
          height: auto;
          max-width: none;
          margin: 0;
          padding: 0;
          background: transparent;
          vertical-align: top;
        }
      </style>
    </head>
    <body>
      <main class="reader">
        ${images}
      </main>
      <script>
        (function () {
          var hasPostedReady = false;
          var touchStart = null;

          function postMessage(type, payload) {
            if (!window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) {
              return;
            }

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: type,
              payload: payload || null,
            }));
          }

          function notifyReady() {
            if (hasPostedReady) return;
            hasPostedReady = true;
            postMessage('content-ready');
          }

          var hasPostedReadable = false;

          function notifyReadable() {
            if (hasPostedReadable) return;
            hasPostedReadable = true;
            postMessage('readable-content');
          }

          function trackImageLoads() {
            var images = Array.prototype.slice.call(document.images || []);
            if (!images.length) {
              notifyReady();
              return;
            }

            var settledCount = 0;

            function markSettled() {
              settledCount += 1;
              if (settledCount >= images.length) {
                notifyReady();
              }
            }

            images.forEach(function (img) {
              if (img.complete) {
                if (img.naturalWidth > 0) {
                  notifyReadable();
                }
                markSettled();
                return;
              }

              img.addEventListener('load', function () {
                notifyReadable();
                markSettled();
              }, { once: true });
              img.addEventListener('error', markSettled, { once: true });
            });

            setTimeout(notifyReady, 1800);
          }

          document.addEventListener('touchstart', function (event) {
            if (event.touches.length !== 1) {
              touchStart = null;
              return;
            }

            var point = event.touches[0];
            touchStart = {
              x: point.clientX,
              y: point.clientY,
              time: Date.now(),
            };
          }, { passive: true });

          document.addEventListener('touchend', function (event) {
            if (!touchStart || event.changedTouches.length !== 1) {
              touchStart = null;
              return;
            }

            var point = event.changedTouches[0];
            var deltaX = Math.abs(point.clientX - touchStart.x);
            var deltaY = Math.abs(point.clientY - touchStart.y);
            var elapsed = Date.now() - touchStart.time;

            if (deltaX < 12 && deltaY < 12 && elapsed < 250) {
              postMessage('toggle-controls');
            }

            touchStart = null;
          }, { passive: true });

          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            trackImageLoads();
          } else {
            document.addEventListener('DOMContentLoaded', trackImageLoads, { once: true });
          }
        })();
      </script>
    </body>
  </html>`;
};

export default function ChapterReader() {
  const { recordProgress } = useLibrary();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [chapterData, setChapterData] = useState<ChapterResponse | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const recordedChapterUrlRef = useRef<string | null>(null);
  const {
    slug,
    chapterUrl,
    mangaTitle: mangaTitleParam,
    mangaCover: mangaCoverParam,
    latestChapterUrl: latestChapterUrlParam,
    latestChapterTitle: latestChapterTitleParam,
    latestChapterNumber: latestChapterNumberParam,
  } = useLocalSearchParams();

  const mangaId = Array.isArray(slug) ? slug[0] : slug || 'reader';
  const currentChapterUrl = Array.isArray(chapterUrl) ? chapterUrl[0] : chapterUrl || '';
  const mangaTitle = Array.isArray(mangaTitleParam)
    ? mangaTitleParam[0]
    : mangaTitleParam || String(mangaId);
  const mangaCover = Array.isArray(mangaCoverParam)
    ? mangaCoverParam[0]
    : mangaCoverParam || null;
  const latestChapterUrl = Array.isArray(latestChapterUrlParam)
    ? latestChapterUrlParam[0]
    : latestChapterUrlParam || null;
  const latestChapterTitle = Array.isArray(latestChapterTitleParam)
    ? latestChapterTitleParam[0]
    : latestChapterTitleParam || null;
  const latestChapterNumberValue = Array.isArray(latestChapterNumberParam)
    ? latestChapterNumberParam[0]
    : latestChapterNumberParam;
  const parsedLatestChapterNumber = latestChapterNumberValue
    ? Number.parseFloat(latestChapterNumberValue)
    : null;

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setLoading(true);
    setWebViewLoaded(false);
    setControlsVisible(true);
    setChapterData(null);
    setErrorMessage(null);
    recordedChapterUrlRef.current = null;

    const fetchChapter = async () => {
      if (!currentChapterUrl) {
        setLoading(false);
        setErrorMessage('Missing chapter URL.');
        return;
      }

      try {
        const response = await getChapter(currentChapterUrl);

        if (requestIdRef.current !== requestId) return;

        const images = (response?.images || [])
          .map((url: string) => getReaderImageUri(url.trim()) || url.trim())
          .filter(Boolean);

        if (images.length === 0) {
          setErrorMessage('This chapter has no readable images yet.');
          return;
        }

        startTransition(() => {
          setChapterData({
            ...response,
            images,
          });
        });
      } catch {
        if (requestIdRef.current === requestId) {
          setErrorMessage('Failed to load this chapter.');
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    };

    void fetchChapter();
  }, [currentChapterUrl]);

  const html = useMemo(() => {
    if (!chapterData?.images?.length) return null;
    return buildReaderHtml(chapterData.images);
  }, [chapterData]);

  useEffect(() => {
    if (!html) return;

    const timeout = setTimeout(() => {
      setWebViewLoaded(true);
    }, 2500);

    return () => clearTimeout(timeout);
  }, [html]);

  useEffect(() => {
    if (!chapterData?.images?.length || !webViewLoaded || loading || errorMessage) {
      return;
    }

    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, [chapterData?.images?.length, errorMessage, loading, webViewLoaded]);

  const navigateToChapter = (targetUrl: string | null) => {
    if (!targetUrl) return;

    router.replace({
      pathname: '/manga/[...slug]',
      params: {
        slug: [mangaId],
        chapterUrl: targetUrl,
        mangaTitle,
        mangaCover: mangaCover || '',
        latestChapterUrl: latestChapterUrl || '',
        latestChapterTitle: latestChapterTitle || '',
        latestChapterNumber:
          parsedLatestChapterNumber != null &&
          Number.isFinite(parsedLatestChapterNumber)
            ? String(parsedLatestChapterNumber)
            : '',
      },
    });
  };

  const recordCurrentChapter = () => {
    if (
      !chapterData ||
      !currentChapterUrl ||
      recordedChapterUrlRef.current === currentChapterUrl
    ) {
      return;
    }

    recordedChapterUrlRef.current = currentChapterUrl;
    const chapterTitle = chapterData.title || 'Chapter';
    const latestChapter =
      latestChapterUrl && latestChapterTitle
        ? {
            url: latestChapterUrl,
            title: latestChapterTitle,
            chapterNumber:
              parsedLatestChapterNumber != null &&
              Number.isFinite(parsedLatestChapterNumber)
                ? parsedLatestChapterNumber
                : extractChapterNumber(latestChapterTitle, latestChapterUrl),
          }
        : null;
    const mangaSnapshot: LibraryMangaSnapshot = {
      mangaId: String(mangaId),
      title: String(mangaTitle),
      cover: mangaCover ? String(mangaCover) : null,
      latestChapter,
    };

    void recordProgress(mangaSnapshot, {
      url: currentChapterUrl,
      title: chapterTitle,
      chapterNumber: extractChapterNumber(chapterTitle, currentChapterUrl),
    }).catch(error => {
      recordedChapterUrlRef.current = null;
      console.warn('Could not save reading progress', error);
    });
  };

  const handleReaderMessage = (event: { nativeEvent: { data?: string } }) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data || '{}');

      if (payload.type === 'content-ready') {
        setWebViewLoaded(true);
        return;
      }

      if (payload.type === 'readable-content') {
        setWebViewLoaded(true);
        recordCurrentChapter();
        return;
      }

      if (payload.type === 'toggle-controls') {
        setControlsVisible((current) => !current);
      }
    } catch {
      // Ignore malformed events from the WebView.
    }
  };

  const showChrome = loading || Boolean(errorMessage) || controlsVisible;

  return (
    <View style={{ flex: 1, backgroundColor: '#05070b' }}>
      {loading ? (
        <ActivityIndicator
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
          size="large"
        />
      ) : errorMessage ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 12 }}>
            {errorMessage}
          </Text>
        </View>
      ) : html ? (
        <>
          {!webViewLoaded ? (
            <ActivityIndicator
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 56,
                left: 0,
                zIndex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              size="large"
            />
          ) : null}
          <WebView
            key={currentChapterUrl}
            source={{ html }}
            originWhitelist={['*']}
            style={{ flex: 1, backgroundColor: '#05070b' }}
            javaScriptEnabled
            domStorageEnabled={false}
            cacheEnabled
            androidLayerType="software"
            mixedContentMode="always"
            scalesPageToFit
            setBuiltInZoomControls
            setDisplayZoomControls={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            overScrollMode="never"
            onMessage={handleReaderMessage}
            onLoad={() => setWebViewLoaded(true)}
            onLoadEnd={() => setWebViewLoaded(true)}
            onLoadProgress={({ nativeEvent }) => {
              if (nativeEvent.progress >= 0.35) {
                setWebViewLoaded(true);
              }
            }}
            onError={() => {
              setWebViewLoaded(true);
              setErrorMessage('Failed to render this chapter.');
            }}
          />
        </>
      ) : null}

      <View
        pointerEvents={showChrome ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          left: 0,
          opacity: showChrome ? 1 : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 12,
            paddingTop: Math.max(insets.top, 10) + 6,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(51, 65, 85, 0.85)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: '#111827',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}
            >
              {chapterData?.title || 'Chapter Reader'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: '#94a3b8', fontSize: 12, marginTop: 3 }}
            >
              Pinch with two fingers to zoom in and out
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: '#1e293b',
              }}
            >
              <Text style={{ color: '#e2e8f0', fontSize: 12, fontWeight: '600' }}>
                {chapterData?.images?.length || 0} pages
              </Text>
            </View>

            <Pressable
              onPress={() => router.dismissTo('/')}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#1d4ed8',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="home-outline" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>

      <View
        pointerEvents={showChrome ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          left: 0,
          opacity: showChrome ? 1 : 0,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 12,
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 10) + 6,
            borderTopWidth: 1,
            borderTopColor: 'rgba(51, 65, 85, 0.85)',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
          }}
        >
          <Pressable
            onPress={() => navigateToChapter(chapterData?.prevChapterUrl || null)}
            disabled={!chapterData?.prevChapterUrl}
            style={{
              flex: 1,
              minHeight: 50,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: chapterData?.prevChapterUrl ? '#1d4ed8' : '#334155',
              opacity: chapterData?.prevChapterUrl ? 1 : 0.6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Previous</Text>
          </Pressable>
          <Pressable
            onPress={() => navigateToChapter(chapterData?.nextChapterUrl || null)}
            disabled={!chapterData?.nextChapterUrl}
            style={{
              flex: 1,
              minHeight: 50,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: chapterData?.nextChapterUrl ? '#7c3aed' : '#334155',
              opacity: chapterData?.nextChapterUrl ? 1 : 0.6,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Next</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
