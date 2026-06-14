import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { startTransition, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import MangaCard from '../components/MangaCard';
import "../global.css";
import { useColorScheme } from '../hooks/useColorScheme';
import { getHomePage, searchManga } from '../services/mangaServices';
const bannerAdUnitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : Constants?.expoConfig?.extra?.adUnitBanner || process.env.AD_UNIT_BANNER;

interface Manga {
  mangaId: string;
  cover: string | null;
  title: string;
  latestChapter: string | null;
  chapterUrl: string | null;
}

type SearchData = {
  mangaId: string;
  title: string;
};


export default function Index() {
  const [data, setData] = useState<Manga[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [homeError, setHomeError] = useState<string | null>(null);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchData, setSearchData] = useState<SearchData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const deferredSearchText = useDeferredValue(searchText.trim());
  const requestedPagesRef = useRef(new Set<number>());
  const endReachedDuringMomentum = useRef(true);
  const homeRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const loadingRef = useRef(loading);
  const refreshingRef = useRef(refreshing);
  const totalPagesRef = useRef(totalPages);
  const dataRef = useRef(data);
  const isDarkMode = useColorScheme() === 'dark';
  const pageSurface = isDarkMode ? '#020617' : '#f8fafc';
  const cardSurface = isDarkMode ? '#0f172a' : '#ffffff';
  const mutedText = isDarkMode ? '#94a3b8' : '#64748b';
  const borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.18)' : 'rgba(15, 23, 42, 0.08)';

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    totalPagesRef.current = totalPages;
  }, [totalPages]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchHomePage = useCallback(async (targetPage: number, mode: 'append' | 'refresh' = 'append') => {
    if ((loadingRef.current || refreshingRef.current) && mode !== 'refresh') return;
    if (mode === 'append' && requestedPagesRef.current.has(targetPage)) return;
    if (totalPagesRef.current !== null && targetPage > totalPagesRef.current) {
      setHasMore(false);
      return;
    }

    const requestId = homeRequestRef.current + 1;
    homeRequestRef.current = requestId;

    if (mode === 'refresh') {
      requestedPagesRef.current.clear();
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    requestedPagesRef.current.add(targetPage);
    setHomeError(null);

    try {
      const res = await getHomePage(targetPage);
      if (homeRequestRef.current !== requestId) return;

      const newMangas = res?.mangas || [];
      const nextTotalPages =
        typeof res?.totalPages === 'number' && Number.isFinite(res.totalPages) && res.totalPages > 0
          ? res.totalPages
          : null;

      if (nextTotalPages !== null) {
        setTotalPages(nextTotalPages);
      }

      const baseItems = mode === 'refresh' ? [] : dataRef.current;
      const seen = new Set(baseItems.map(item => item.mangaId));
      const additions = newMangas.filter((item: Manga) => !seen.has(item.mangaId));
      const nextItems = [...baseItems, ...additions];

      startTransition(() => {
        dataRef.current = nextItems;
        setData(nextItems);
      });

      setPage(targetPage);

      const reachedEnd = nextTotalPages !== null ? targetPage >= nextTotalPages : newMangas.length === 0;
      setHasMore(!reachedEnd);
    } catch (error) {
      if (homeRequestRef.current !== requestId) return;

      requestedPagesRef.current.delete(targetPage);
      console.error(error);

      const status =
        typeof error === 'object' && error && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status
          : undefined;

      if (status === 404) {
        setHasMore(false);
      } else if (targetPage === 1 && dataRef.current.length === 0) {
        setHomeError('Could not load the latest manga right now.');
      }
    } finally {
      if (homeRequestRef.current !== requestId) return;

      if (mode === 'refresh') {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const loadMore = () => {
    if (loading || refreshing || !hasMore) return;
    if (totalPages !== null && page >= totalPages) {
      setHasMore(false);
      return;
    }

    void fetchHomePage(page + 1);
  };

  useEffect(() => {
    void fetchHomePage(1);
  }, [fetchHomePage]);

  const refreshHome = () => {
    setPage(0);
    setHasMore(true);
    setTotalPages(null);
    void fetchHomePage(1, 'refresh');
  };

  useEffect(() => {
    if (!searchVisible) {
      setSearchLoading(false);
      setSearchData([]);
      setSearchError(null);
      return;
    }

    if (!deferredSearchText) {
      searchRequestRef.current += 1;
      setSearchLoading(false);
      setSearchData([]);
      setSearchError(null);
      return;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setSearchLoading(true);
    setSearchError(null);

    const delay = setTimeout(() => {
      const performSearch = async () => {
        try {
          const res = await searchManga(deferredSearchText);

          if (searchRequestRef.current !== requestId) return;

          startTransition(() => {
            setSearchData(res?.results || []);
            setSearchError(null);
          });
        } catch (error) {
          if (searchRequestRef.current !== requestId) return;
          console.error(error);
          startTransition(() => {
            setSearchData([]);
            setSearchError('Search is unavailable right now. Please try again.');
          });
        } finally {
          if (searchRequestRef.current === requestId) {
            setSearchLoading(false);
          }
        }
      };

      void performSearch();
    }, 250);

    return () => clearTimeout(delay);
  }, [deferredSearchText, searchVisible]);

  const mangaPageHandler = (mangaId: string) => {
    router.push(`/mangaInfo/${mangaId}`);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: 'MangaFy',
          headerRight: () => (
            <TouchableOpacity
              className='h-10 w-10 justify-center items-center'
              style={{ marginRight: 15 }}
              onPress={() => {
                setSearchVisible(prev => !prev);
                setSearchData([]);
                setSearchError(null);
                setSearchText("")
              }}
            >
              <Text>
                <Ionicons
                  name={searchVisible ? 'close' : 'search'}
                  size={24}
                  color={isDarkMode ? 'white' : 'black'}
                />
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: pageSurface }}>
          <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {searchVisible && (
              <View style={{ marginBottom: 14 }}>
                <TextInput
                  placeholder="Search manga..."
                  value={searchText}
                  onChangeText={setSearchText}
                  style={{
                    backgroundColor: cardSurface,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    color: isDarkMode ? 'white' : '#0f172a',
                    borderWidth: 1,
                    borderColor,
                  }}
                  placeholderTextColor={mutedText}
                  autoFocus
                />
                {searchText.trim().length > 0 && (
                  <View
                    style={{
                      backgroundColor: cardSurface,
                      borderRadius: 16,
                      elevation: 4,
                      maxHeight: 200,
                      marginTop: 6,
                      borderWidth: 1,
                      borderColor,
                      overflow: 'hidden',
                    }}
                  >
                    {searchLoading ? (
                      <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={isDarkMode ? '#bfdbfe' : '#2563eb'} />
                      </View>
                    ) : searchError ? (
                      <View style={{ paddingVertical: 14, paddingHorizontal: 12 }}>
                        <Text style={{ color: '#f59e0b' }}>
                          {searchError}
                        </Text>
                      </View>
                    ) : searchData.length > 0 ? (
                      <FlatList
                        data={searchData}
                        keyboardShouldPersistTaps="handled"
                        keyExtractor={(item) => item.mangaId}
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={() => {
                              setSearchText('');
                              setSearchVisible(false);
                              setSearchData([]);
                              setSearchError(null);
                              mangaPageHandler(item.mangaId);
                            }}
                            style={{
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderBottomWidth: 1,
                              borderBottomColor: borderColor,
                            }}
                          >
                            <Text style={{ color: isDarkMode ? '#fff' : '#0f172a' }}>{item.title}</Text>
                          </Pressable>
                        )}
                      />
                    ) : (
                      <View style={{ paddingVertical: 14, paddingHorizontal: 12 }}>
                        <Text style={{ color: mutedText }}>
                          {'No manga found for "'}{searchText.trim()}{'".'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            <FlatList
              data={data}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 14 }}
              contentContainerStyle={{ paddingBottom: 18, flexGrow: 1 }}
              removeClippedSubviews
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={7}
              updateCellsBatchingPeriod={50}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={refreshHome}
                  tintColor={isDarkMode ? '#bfdbfe' : '#2563eb'}
                />
              }
              ListHeaderComponent={
                <View style={{ marginBottom: 18 }}>
                  <View
                    style={{
                      paddingTop: 8,
                      marginBottom: 14,
                    }}
                  >
                    <Text
                      style={{
                        color: mutedText,
                        fontSize: 12,
                        fontWeight: '800',
                        letterSpacing: 1.2,
                        textTransform: 'uppercase',
                      }}
                    >
                      MangaFy Feed
                    </Text>
                    <Text
                      style={{
                        color: isDarkMode ? '#fff' : '#0f172a',
                        fontSize: 30,
                        fontWeight: '800',
                        marginTop: 6,
                      }}
                    >
                      Latest Chapters
                    </Text>
                    <Text
                      style={{
                        color: mutedText,
                        marginTop: 6,
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      Pick a title and jump straight into the newest chapter.
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          backgroundColor: isDarkMode ? '#60a5fa' : '#2563eb',
                        }}
                      />
                      <View
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.55)' : 'rgba(219, 234, 254, 0.8)',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                        }}
                      >
                        <Text style={{ color: isDarkMode ? '#bfdbfe' : '#1d4ed8', fontWeight: '700', fontSize: 12 }}>
                          {data.length} titles
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              }
              ListEmptyComponent={
                !loading ? (
                  <View
                    style={{
                      backgroundColor: cardSurface,
                      borderRadius: 20,
                      padding: 20,
                      borderWidth: 1,
                      borderColor,
                    }}
                  >
                    <Text style={{ color: isDarkMode ? '#fff' : '#0f172a', fontWeight: '700', fontSize: 16 }}>
                      {homeError ? 'Something went wrong' : 'Nothing here yet'}
                    </Text>
                    <Text style={{ color: mutedText, marginTop: 6 }}>
                      {homeError || 'Pull to refresh or try again in a moment.'}
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={{ width: '48.2%' }}>
                  <MangaCard
                    Img={item.cover}
                    name={item.title}
                    chapter={item.latestChapter}
                    mangaId={item.mangaId}
                    chapterUrl={item.chapterUrl}
                  />
                </View>
              )}
              keyExtractor={(item) => item.mangaId}
              onMomentumScrollBegin={() => {
                endReachedDuringMomentum.current = false;
              }}
              onEndReached={() => {
                if (endReachedDuringMomentum.current) return;
                endReachedDuringMomentum.current = true;
                loadMore();
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                loading && data.length > 0 ? (
                  <ActivityIndicator size="large" color="#FF9900" />
                ) : !hasMore && data.length > 0 && totalPages !== null && page >= totalPages ? (
                  <Text style={{ color: mutedText, textAlign: 'center', paddingBottom: 8 }}>
                    You&apos;re caught up for now.
                  </Text>
                ) : null
              }
            />
          </View>

          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: borderColor,
              backgroundColor: cardSurface,
              paddingTop: 8,
              paddingBottom: 8,
              alignItems: 'center',
            }}
          >
            <BannerAd
              unitId={bannerAdUnitId}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
              onAdLoaded={() => {
                console.log('Home banner loaded');
              }}
              onAdFailedToLoad={(error) => {
                console.log('Home banner failed to load', error);
              }}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </>
  );
}
