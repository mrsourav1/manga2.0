import Constants from 'expo-constants';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import ChapterCard from '../../components/ChapterCard';
import { useLibrary } from '../../context/LibraryContext';
import type { LibraryStatus } from '../../services/libraryDatabase';
import { getDetailImageUri, getOriginalImageUri } from '../../services/imageUrls';
import { toChapterSnapshot, toLibrarySnapshot } from '../../services/librarySnapshots';
import { getMangaDetails } from '../../services/mangaServices';

const adUnitId =
    __DEV__ ? TestIds.ADAPTIVE_BANNER : Constants?.expoConfig?.extra?.adUnitBanner || process.env.AD_UNIT_BANNER;

type Chapter = {
    title: string;
    url: string;
    chapterNumber: number | null;
    date: string | null;
};

type MangaData = {
    mangaId: string;
    cover: string | null;
    title: string;
    summary: string | null;
    rankLine: string | null;
    status: string | null;
    genres: string[];
    chapters: Chapter[];
    lastUpdated: string;
};

const MangaDetail = () => {
    const {
        addManga,
        getEntry,
        getHistoryEntry,
        isChapterRead,
        removeManga,
        setChapterRead,
        syncManga,
        updateStatus,
    } = useLibrary();
    const { slug } = useLocalSearchParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MangaData | null>(null);
    const [coverUri, setCoverUri] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const syncedDetailsRef = useRef<string | null>(null);
    const mangaId = Array.isArray(slug) ? slug[0] : slug;

    useEffect(() => {
        requestIdRef.current += 1;
        const requestId = requestIdRef.current;

        setLoading(true);
        setErrorMessage(null);
        setData(null);

        const fetchMangaDetails = async () => {
            if (!mangaId) {
                setErrorMessage('Missing manga details.');
                setLoading(false);
                return;
            }

            try {
                const res = await getMangaDetails(mangaId);

                if (requestIdRef.current !== requestId) return;

                startTransition(() => {
                    setData(res);
                });
            } catch (error) {
                if (requestIdRef.current !== requestId) return;
                console.log(error);
                setErrorMessage('Could not load this manga right now.');
            } finally {
                if (requestIdRef.current === requestId) {
                    setLoading(false);
                }
            }
        };

        void fetchMangaDetails();
    }, [mangaId]);

    useEffect(() => {
        setCoverUri(getDetailImageUri(data?.cover?.trim() || null));
    }, [data?.cover]);

    const chapters = data?.chapters || [];
    const firstChapter = chapters[0] || null;
    const latestChapter = chapters[chapters.length - 1] || null;
    const orderedChapters = chapters.length > 1 ? [...chapters].reverse() : chapters;
    const librarySnapshot = useMemo(
        () => toLibrarySnapshot(data || {}),
        [data]
    );
    const libraryEntry = mangaId ? getEntry(mangaId) : null;
    const historyEntry = mangaId ? getHistoryEntry(mangaId) : null;
    const continueChapter = libraryEntry?.lastReadChapterUrl
        ? {
            title: libraryEntry.lastReadChapterTitle || 'Continue reading',
            url: libraryEntry.lastReadChapterUrl,
            chapterNumber: libraryEntry.lastReadChapterNumber,
            date: null,
        }
        : historyEntry
            ? {
                title: historyEntry.lastReadChapterTitle,
                url: historyEntry.lastReadChapterUrl,
                chapterNumber: historyEntry.lastReadChapterNumber,
                date: null,
            }
            : null;

    useEffect(() => {
        if (!libraryEntry || !librarySnapshot) return;

        const syncKey = `${librarySnapshot.mangaId}:${data?.lastUpdated || ''}`;
        if (syncedDetailsRef.current === syncKey) return;
        syncedDetailsRef.current = syncKey;
        void syncManga(librarySnapshot);
    }, [data?.lastUpdated, libraryEntry, librarySnapshot, syncManga]);

    const openChapter = async (chapter: Chapter | null) => {
        const chapterSnapshot = chapter ? toChapterSnapshot(chapter) : null;
        if (!chapterSnapshot || !librarySnapshot) return;

        router.push({
            pathname: '/manga/[...slug]',
            params: {
                slug: [data?.mangaId || mangaId || ''],
                chapterUrl: chapterSnapshot.url,
                mangaTitle: librarySnapshot.title,
                mangaCover: librarySnapshot.cover || '',
                chapterTitle: chapterSnapshot.title,
                chapterNumber:
                    chapterSnapshot.chapterNumber != null
                        ? String(chapterSnapshot.chapterNumber)
                        : '',
                latestChapterUrl: librarySnapshot.latestChapter?.url || '',
                latestChapterTitle: librarySnapshot.latestChapter?.title || '',
                latestChapterNumber:
                    librarySnapshot.latestChapter?.chapterNumber != null
                        ? String(librarySnapshot.latestChapter.chapterNumber)
                        : '',
            },
        });
    };

    const toggleLibrary = () => {
        if (!librarySnapshot) return;

        if (!libraryEntry) {
            void addManga(librarySnapshot);
            return;
        }

        Alert.alert(
            'Remove from library?',
            'This will remove it from your saved library, but reading history will stay on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => void removeManga(librarySnapshot.mangaId),
                },
            ]
        );
    };

    const handleChapterReadToggle = async (chapter: Chapter) => {
        const chapterSnapshot = toChapterSnapshot(chapter);
        if (!chapterSnapshot || !librarySnapshot) return;

        await setChapterRead(
            librarySnapshot.mangaId,
            chapterSnapshot,
            !isChapterRead(librarySnapshot.mangaId, chapterSnapshot.url)
        );
    };

    const statuses: { value: LibraryStatus; label: string }[] = [
        { value: 'reading', label: 'Reading' },
        { value: 'completed', label: 'Completed' },
        { value: 'on-hold', label: 'On hold' },
        { value: 'dropped', label: 'Dropped' },
    ];

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#020617' }}>
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (errorMessage) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 24,
                    backgroundColor: '#020617',
                }}
            >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center' }}>
                    {errorMessage}
                </Text>
            </View>
        );
    }

    return (
        <>
            <Stack.Screen
                options={{
                    title: data?.title || 'Manga Details',
                    headerBackTitle: 'Back',
                }}
            />
            <FlatList
                data={orderedChapters}
                style={{ flex: 1, backgroundColor: '#020617' }}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={18}
                maxToRenderPerBatch={12}
                windowSize={9}
                keyExtractor={(item) => item.url}
                ListHeaderComponent={
                    <>
                    <BannerAd
                        unitId={adUnitId}
                        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                        onAdLoaded={() => {
                            console.log('Detail banner loaded');
                        }}
                        onAdFailedToLoad={(error) => {
                            console.log('Detail banner failed to load', error);
                        }}
                    />

                    <View style={{ alignItems: 'center', paddingTop: 6 }}>
                        {data?.cover ? (
                            <Image
                                source={{ uri: coverUri || 'https://via.placeholder.com/220x330?text=Manga' }}
                                style={{
                                    width: 220,
                                    height: 330,
                                    borderRadius: 20,
                                    backgroundColor: '#CBD5E1',
                                }}
                                resizeMode="cover"
                                resizeMethod="scale"
                                fadeDuration={500}
                                onError={() => {
                                    const originalCover = getOriginalImageUri(data?.cover?.trim() || null);

                                    if (coverUri !== originalCover) {
                                        setCoverUri(originalCover);
                                    } else {
                                        setCoverUri(null);
                                    }
                                }}
                            />
                        ) : null}
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                        <Text
                            style={{
                                color: '#fff',
                                fontSize: 22,
                                fontWeight: '800',
                                textAlign: 'center',
                            }}
                        >
                            {data?.title}
                        </Text>
                    </View>

                    <View
                        style={{
                            marginHorizontal: 16,
                            marginTop: 16,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: libraryEntry ? 'rgba(96, 165, 250, 0.5)' : 'rgba(148, 163, 184, 0.16)',
                            backgroundColor: libraryEntry ? '#172554' : '#0f172a',
                            padding: 14,
                        }}
                    >
                        <Pressable
                            onPress={toggleLibrary}
                            style={{
                                minHeight: 48,
                                borderRadius: 14,
                                backgroundColor: libraryEntry ? '#1e3a8a' : '#2563eb',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                {libraryEntry ? 'Remove from Library' : 'Add to Library'}
                            </Text>
                        </Pressable>

                        {libraryEntry ? (
                            <>
                                <Text
                                    style={{
                                        color: '#bfdbfe',
                                        fontSize: 12,
                                        fontWeight: '700',
                                        marginTop: 14,
                                        marginBottom: 8,
                                    }}
                                >
                                    Reading status
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {statuses.map(status => {
                                        const selected = libraryEntry.status === status.value;

                                        return (
                                            <Pressable
                                                key={status.value}
                                                onPress={() => void updateStatus(libraryEntry.mangaId, status.value)}
                                                style={{
                                                    borderRadius: 999,
                                                    backgroundColor: selected ? '#2563eb' : '#1e293b',
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 8,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: selected ? '#fff' : '#94a3b8',
                                                        fontSize: 11,
                                                        fontWeight: '800',
                                                    }}
                                                >
                                                    {status.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </>
                        ) : null}
                    </View>

                    <View
                        style={{
                            backgroundColor: '#334155',
                            marginHorizontal: 16,
                            marginTop: 16,
                            borderRadius: 18,
                            padding: 14,
                            gap: 8,
                        }}
                    >
                        {data?.rankLine ? (
                            <Text style={{ color: '#fff', textAlign: 'center' }}>
                                Rank: {data.rankLine}
                            </Text>
                        ) : null}
                        {data?.status ? (
                            <Text style={{ color: '#fff', textAlign: 'center' }}>
                                Status: {data.status}
                            </Text>
                        ) : null}
                        <Text style={{ color: '#f87171', textAlign: 'center', fontWeight: '700' }}>
                            Summary
                        </Text>
                        <Text style={{ color: '#fff', lineHeight: 22 }}>
                            {data?.summary || 'Summary is not available for this manga.'}
                        </Text>
                        {data?.genres?.length ? (
                            <Text style={{ color: '#fff', textAlign: 'center', lineHeight: 22 }}>
                                Genres: {data.genres.join(', ')}
                            </Text>
                        ) : null}
                    </View>

                    <View
                        style={{
                            marginHorizontal: 16,
                            marginTop: 16,
                            marginBottom: 16,
                            padding: 16,
                            borderRadius: 20,
                            backgroundColor: '#0f172a',
                            borderWidth: 1,
                            borderColor: 'rgba(148, 163, 184, 0.16)',
                        }}
                    >
                        <Text
                            style={{
                                color: '#ffffff',
                                fontSize: 16,
                                fontWeight: '800',
                            }}
                        >
                            Quick Start
                        </Text>
                        <Text
                            style={{
                                color: '#94a3b8',
                                marginTop: 4,
                                marginBottom: 14,
                                fontSize: 13,
                                lineHeight: 18,
                            }}
                        >
                            Jump to the latest chapter or begin from chapter one.
                        </Text>
                        {continueChapter ? (
                            <Pressable
                                onPress={() =>
                                    void openChapter(continueChapter)
                                }
                                style={{
                                    minHeight: 52,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#059669',
                                    marginBottom: 12,
                                }}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                    Continue Reading
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={{ color: '#d1fae5', fontSize: 11, marginTop: 4 }}
                                >
                                    {continueChapter.title}
                                </Text>
                            </Pressable>
                        ) : null}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Pressable
                                onPress={() => void openChapter(latestChapter)}
                                disabled={!latestChapter?.url}
                                style={{
                                    flex: 1,
                                    minHeight: 48,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: latestChapter?.url ? '#1d4ed8' : '#334155',
                                    opacity: latestChapter?.url ? 1 : 0.6,
                                }}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                    Read Latest
                                </Text>
                                {latestChapter?.title ? (
                                    <Text
                                        numberOfLines={1}
                                        style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 }}
                                    >
                                        {latestChapter.title}
                                    </Text>
                                ) : null}
                            </Pressable>

                            <Pressable
                                onPress={() => void openChapter(firstChapter)}
                                disabled={!firstChapter?.url}
                                style={{
                                    flex: 1,
                                    minHeight: 48,
                                    borderRadius: 14,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: firstChapter?.url ? '#7c3aed' : '#334155',
                                    opacity: firstChapter?.url ? 1 : 0.6,
                                }}
                            >
                                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>
                                    Start Reading
                                </Text>
                                {firstChapter?.title ? (
                                    <Text
                                        numberOfLines={1}
                                        style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 4 }}
                                    >
                                        {firstChapter.title}
                                    </Text>
                                ) : null}
                            </Pressable>
                        </View>
                    </View>
                    <View
                        style={{
                            marginHorizontal: 16,
                            marginBottom: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800' }}>
                            Chapters
                        </Text>
                        <Text
                            style={{
                                color: '#bfdbfe',
                                fontSize: 12,
                                fontWeight: '700',
                                backgroundColor: 'rgba(37, 99, 235, 0.16)',
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 999,
                            }}
                        >
                            {orderedChapters.length} total
                        </Text>
                    </View>
                    </>
                }
                ListEmptyComponent={
                    <View
                        style={{
                            marginHorizontal: 16,
                            borderRadius: 18,
                            backgroundColor: '#334155',
                            padding: 16,
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '700' }}>No chapters available yet.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={{ marginHorizontal: 16 }}>
                        <ChapterCard
                            name={item.title}
                            date={item.date}
                            isRead={isChapterRead(data?.mangaId || mangaId || '', item.url)}
                            onPress={() => void openChapter(item)}
                            onToggleRead={() => void handleChapterReadToggle(item)}
                        />
                    </View>
                )}
            />
        </>
    );
};

export default MangaDetail;
