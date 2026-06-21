import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { useLibrary } from '../context/LibraryContext';
import { getCardImageUri, getOriginalImageUri } from '../services/imageUrls';
import type {
  LibraryMangaSnapshot,
  ReadingHistoryEntry,
} from '../services/libraryDatabase';

const DAY_MS = 24 * 60 * 60 * 1000;

const formatLastRead = (timestamp: number) => {
  const elapsed = Date.now() - timestamp;

  if (elapsed < DAY_MS) return 'Today';
  if (elapsed < DAY_MS * 2) return 'Yesterday';
  if (elapsed < DAY_MS * 7) {
    return `${Math.max(1, Math.floor(elapsed / DAY_MS))} days ago`;
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const toSnapshot = (entry: ReadingHistoryEntry): LibraryMangaSnapshot => ({
  mangaId: entry.mangaId,
  title: entry.title,
  cover: entry.cover,
  latestChapter: entry.latestChapterUrl
    ? {
        title: entry.latestChapterTitle || 'Latest chapter',
        url: entry.latestChapterUrl,
        chapterNumber: entry.latestChapterNumber,
      }
    : null,
});

type HistoryCardProps = {
  entry: ReadingHistoryEntry;
  isSaved: boolean;
  saving: boolean;
  onSave: () => void;
};

const HistoryCard = ({ entry, isSaved, saving, onSave }: HistoryCardProps) => {
  const preferredImage = getCardImageUri(entry.cover);
  const fallbackImage = getOriginalImageUri(entry.cover);
  const [imageUri, setImageUri] = useState(preferredImage || fallbackImage);

  useEffect(() => {
    setImageUri(preferredImage || fallbackImage);
  }, [fallbackImage, preferredImage]);

  const continueReading = () => {
    router.push({
      pathname: '/manga/[...slug]',
      params: {
        slug: [entry.mangaId],
        chapterUrl: entry.lastReadChapterUrl,
        mangaTitle: entry.title,
        mangaCover: entry.cover || '',
        chapterTitle: entry.lastReadChapterTitle,
        chapterNumber:
          entry.lastReadChapterNumber != null
            ? String(entry.lastReadChapterNumber)
            : '',
        latestChapterUrl: entry.latestChapterUrl || '',
        latestChapterTitle: entry.latestChapterTitle || '',
        latestChapterNumber:
          entry.latestChapterNumber != null
            ? String(entry.latestChapterNumber)
            : '',
      },
    });
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.16)',
        backgroundColor: '#0f172a',
        padding: 12,
      }}
    >
      <Pressable onPress={() => router.push(`/mangaInfo/${entry.mangaId}`)}>
        <Image
          source={{
            uri:
              imageUri ||
              'https://via.placeholder.com/180x250?text=Manga',
          }}
          style={{
            width: 92,
            height: 132,
            borderRadius: 14,
            backgroundColor: '#1e293b',
          }}
          resizeMode="cover"
          onError={() => {
            if (imageUri !== fallbackImage) {
              setImageUri(fallbackImage);
            } else {
              setImageUri(null);
            }
          }}
        />
      </Pressable>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              color: '#fff',
              fontSize: 17,
              fontWeight: '800',
              lineHeight: 22,
            }}
          >
            {entry.title}
          </Text>

          <View
            style={{
              borderRadius: 999,
              backgroundColor: isSaved ? '#064e3b' : '#1e293b',
              paddingHorizontal: 9,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                color: isSaved ? '#bbf7d0' : '#cbd5e1',
                fontSize: 10,
                fontWeight: '900',
              }}
            >
              {isSaved ? 'SAVED' : 'HISTORY'}
            </Text>
          </View>
        </View>

        <Text
          numberOfLines={1}
          style={{ color: '#94a3b8', fontSize: 12, marginTop: 7 }}
        >
          Last read: {entry.lastReadChapterTitle}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}
        >
          {formatLastRead(entry.lastReadAt)}
          {entry.latestChapterTitle ? ` • Latest: ${entry.latestChapterTitle}` : ''}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 'auto',
          }}
        >
          <Pressable
            onPress={continueReading}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 12,
              backgroundColor: '#2563eb',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 10,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}
            >
              Continue
            </Text>
          </Pressable>

          <Pressable
            onPress={isSaved ? () => router.push(`/mangaInfo/${entry.mangaId}`) : onSave}
            disabled={saving}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: isSaved ? '#1e293b' : '#0f766e',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#ccfbf1" />
            ) : (
              <Ionicons
                name={isSaved ? 'library-outline' : 'bookmark-outline'}
                size={20}
                color={isSaved ? '#cbd5e1' : '#ccfbf1'}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default function HistoryScreen() {
  const { addManga, entries, error, historyEntries, initializing } = useLibrary();
  const [savingId, setSavingId] = useState<string | null>(null);
  const savedIds = useMemo(
    () => new Set(entries.map(entry => entry.mangaId)),
    [entries]
  );

  const saveToLibrary = async (entry: ReadingHistoryEntry) => {
    setSavingId(entry.mangaId);
    try {
      await addManga(toSnapshot(entry));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14 }}>
            <Text
              style={{
                color: '#2dd4bf',
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1.4,
              }}
            >
              PICK UP AGAIN
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 32,
                fontWeight: '900',
                marginTop: 5,
              }}
            >
              History
            </Text>
            <Text
              style={{
                color: '#94a3b8',
                fontSize: 14,
                lineHeight: 20,
                marginTop: 5,
              }}
            >
              Manga you opened recently, even if you did not save it yet.
            </Text>
          </View>

          {initializing ? (
            <ActivityIndicator
              style={{ flex: 1 }}
              size="large"
              color="#2dd4bf"
            />
          ) : (
            <FlatList
              data={historyEntries}
              keyExtractor={item => item.mangaId}
              renderItem={({ item }) => (
                <HistoryCard
                  entry={item}
                  isSaved={savedIds.has(item.mangaId)}
                  saving={savingId === item.mangaId}
                  onSave={() => void saveToLibrary(item)}
                />
              )}
              contentContainerStyle={{
                gap: 12,
                paddingHorizontal: 16,
                paddingBottom: 22,
                flexGrow: 1,
              }}
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    minHeight: 360,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 34,
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 24,
                      backgroundColor: '#134e4a',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="time-outline" size={34} color="#2dd4bf" />
                  </View>
                  <Text
                    style={{
                      color: '#fff',
                      fontSize: 20,
                      fontWeight: '800',
                      marginTop: 18,
                      textAlign: 'center',
                    }}
                  >
                    Nothing read yet
                  </Text>
                  <Text
                    style={{
                      color: '#94a3b8',
                      lineHeight: 21,
                      marginTop: 8,
                      textAlign: 'center',
                    }}
                  >
                    {error ||
                      'Open any chapter and it will appear here automatically.'}
                  </Text>
                  <Pressable
                    onPress={() => router.replace('/')}
                    style={{
                      borderRadius: 14,
                      backgroundColor: '#0f766e',
                      marginTop: 18,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      Browse manga
                    </Text>
                  </Pressable>
                </View>
              }
            />
          )}
        </View>

        <BottomNavigation active="history" />
      </SafeAreaView>
    </>
  );
}
