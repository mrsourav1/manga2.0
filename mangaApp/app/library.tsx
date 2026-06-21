import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { useLibrary } from '../context/LibraryContext';
import {
  type LibraryEntry,
  type LibraryStatus,
} from '../services/libraryDatabase';
import { getCardImageUri, getOriginalImageUri } from '../services/imageUrls';
import { toLibrarySnapshot } from '../services/librarySnapshots';
import { getMangaDetails } from '../services/mangaServices';

const DAY_MS = 24 * 60 * 60 * 1000;

const filters: {
  value: 'all' | LibraryStatus;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'reading', label: 'Reading' },
  { value: 'completed', label: 'Completed' },
  { value: 'on-hold', label: 'On hold' },
  { value: 'dropped', label: 'Dropped' },
];

const statusLabels: Record<LibraryStatus, string> = {
  reading: 'Reading',
  completed: 'Completed',
  'on-hold': 'On hold',
  dropped: 'Dropped',
};

const sortOptions = [
  { value: 'recent' as const, label: 'Recent' },
  { value: 'unread' as const, label: 'Unread' },
  { value: 'title' as const, label: 'A-Z' },
];

const LibraryCard = ({ entry }: { entry: LibraryEntry }) => {
  const preferredImage = getCardImageUri(entry.cover);
  const fallbackImage = getOriginalImageUri(entry.cover);
  const [imageUri, setImageUri] = useState(preferredImage || fallbackImage);

  useEffect(() => {
    setImageUri(preferredImage || fallbackImage);
  }, [fallbackImage, preferredImage]);

  const continueReading = () => {
    if (!entry.lastReadChapterUrl) {
      router.push(`/mangaInfo/${entry.mangaId}`);
      return;
    }

    router.push({
      pathname: '/manga/[...slug]',
      params: {
        slug: [entry.mangaId],
        chapterUrl: entry.lastReadChapterUrl,
        mangaTitle: entry.title,
        mangaCover: entry.cover || '',
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
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
          {entry.unreadCount > 0 ? (
            <View
              style={{
                minWidth: 28,
                borderRadius: 999,
                backgroundColor: '#dc2626',
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: '800',
                }}
              >
                {entry.unreadCount > 99 ? '99+' : entry.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          numberOfLines={1}
          style={{ color: '#94a3b8', fontSize: 12, marginTop: 7 }}
        >
          {entry.lastReadChapterTitle
            ? `Last read: ${entry.lastReadChapterTitle}`
            : 'Not started yet'}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}
        >
          {entry.latestChapterTitle
            ? `Latest: ${entry.latestChapterTitle}`
            : statusLabels[entry.status]}
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
              {entry.lastReadChapterUrl ? 'Continue reading' : 'View chapters'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/mangaInfo/${entry.mangaId}`)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: '#1e293b',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="list-outline" size={20} color="#cbd5e1" />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default function LibraryScreen() {
  const { entries, error, initializing, syncManga } = useLibrary();
  const [filter, setFilter] = useState<'all' | LibraryStatus>('all');
  const [sort, setSort] = useState<'recent' | 'unread' | 'title'>('recent');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const automaticRefreshStarted = useRef(false);

  const filteredEntries =
    filter === 'all'
      ? entries
      : entries.filter(entry => entry.status === filter);
  const visibleEntries = [...filteredEntries].sort((left, right) => {
    if (sort === 'title') {
      return left.title.localeCompare(right.title);
    }

    if (sort === 'unread') {
      return (
        right.unreadCount - left.unreadCount ||
        (right.lastReadAt || right.addedAt) -
          (left.lastReadAt || left.addedAt)
      );
    }

    return (
      (right.lastReadAt || right.addedAt) -
      (left.lastReadAt || left.addedAt)
    );
  });

  const refreshLibrary = useCallback(async () => {
    if (refreshing || entries.length === 0) return;

    setRefreshing(true);
    setRefreshMessage(null);
    let refreshedCount = 0;

    for (const entry of entries) {
      try {
        const details = await getMangaDetails(entry.mangaId);
        const snapshot = toLibrarySnapshot(details);

        if (snapshot) {
          await syncManga(snapshot);
          refreshedCount += 1;
        }
      } catch (nextError) {
        console.warn(`Could not refresh ${entry.title}`, nextError);
      }
    }

    setRefreshMessage(
      refreshedCount === entries.length
        ? 'Library is up to date.'
        : `Updated ${refreshedCount} of ${entries.length} titles.`
    );
    setRefreshing(false);
  }, [entries, refreshing, syncManga]);

  useEffect(() => {
    if (
      automaticRefreshStarted.current ||
      initializing ||
      entries.length === 0
    ) {
      return;
    }

    automaticRefreshStarted.current = true;
    const needsRefresh = entries.some(
      entry =>
        entry.lastCheckedAt == null ||
        Date.now() - entry.lastCheckedAt >= DAY_MS
    );

    if (needsRefresh) {
      void refreshLibrary();
    }
  }, [entries, initializing, refreshLibrary]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: '#020617' }}>
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
            <Text
              style={{
                color: '#60a5fa',
                fontSize: 12,
                fontWeight: '800',
                letterSpacing: 1.4,
              }}
            >
              YOUR SHELF
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 32,
                fontWeight: '900',
                marginTop: 5,
              }}
            >
              Library
            </Text>
            <Text
              style={{
                color: '#94a3b8',
                fontSize: 14,
                lineHeight: 20,
                marginTop: 5,
              }}
            >
              Keep the titles you intentionally saved.
            </Text>

            <FlatList
              horizontal
              data={filters}
              keyExtractor={item => item.value}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 16 }}
              renderItem={({ item }) => {
                const selected = filter === item.value;

                return (
                  <Pressable
                    onPress={() => setFilter(item.value)}
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected
                        ? '#60a5fa'
                        : 'rgba(148, 163, 184, 0.18)',
                      backgroundColor: selected ? '#1d4ed8' : '#0f172a',
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#fff' : '#94a3b8',
                        fontSize: 12,
                        fontWeight: '800',
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  color: '#64748b',
                  fontSize: 11,
                  fontWeight: '800',
                  marginRight: 2,
                }}
              >
                SORT
              </Text>
              {sortOptions.map(option => {
                const selected = sort === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSort(option.value)}
                    style={{
                      borderRadius: 10,
                      backgroundColor: selected ? '#1e3a8a' : '#0f172a',
                      paddingHorizontal: 11,
                      paddingVertical: 7,
                    }}
                  >
                    <Text
                      style={{
                        color: selected ? '#bfdbfe' : '#64748b',
                        fontSize: 11,
                        fontWeight: '800',
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {initializing ? (
            <ActivityIndicator
              style={{ flex: 1 }}
              size="large"
              color="#60a5fa"
            />
          ) : (
            <FlatList
              data={visibleEntries}
              keyExtractor={item => item.mangaId}
              renderItem={({ item }) => <LibraryCard entry={item} />}
              contentContainerStyle={{
                gap: 12,
                paddingHorizontal: 16,
                paddingBottom: 22,
                flexGrow: 1,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => void refreshLibrary()}
                  tintColor="#60a5fa"
                />
              }
              ListHeaderComponent={
                refreshMessage ? (
                  <Text
                    style={{
                      color: '#94a3b8',
                      fontSize: 12,
                      paddingBottom: 2,
                    }}
                  >
                    {refreshMessage}
                  </Text>
                ) : null
              }
              ListEmptyComponent={
                <View
                  style={{
                    flex: 1,
                    minHeight: 300,
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
                      backgroundColor: '#172554',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name="library-outline"
                      size={34}
                      color="#60a5fa"
                    />
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
                    {entries.length === 0
                      ? 'Your library is waiting'
                      : 'No titles in this section'}
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
                      (entries.length === 0
                        ? 'Add manga from their details page to keep them here.'
                        : 'Choose another filter to see the rest of your library.')}
                  </Text>
                  {entries.length === 0 ? (
                    <Pressable
                      onPress={() => router.replace('/')}
                      style={{
                        borderRadius: 14,
                        backgroundColor: '#2563eb',
                        marginTop: 18,
                        paddingHorizontal: 18,
                        paddingVertical: 12,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800' }}>
                        Browse manga
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              }
            />
          )}
        </View>

        <BottomNavigation active="library" />
      </SafeAreaView>
    </>
  );
}
