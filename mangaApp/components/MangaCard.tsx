import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { getCardImageUri, getOriginalImageUri } from '../services/imageUrls';

interface MangaCardProps {
    Img: string | null;
    name: string;
    chapter: string | null;
    mangaId: string;
    chapterUrl:string | null;
}

const MangaCard: React.FC<MangaCardProps> = ({ Img, name, chapter, mangaId, chapterUrl}) => {
    const preferredImageUri = useMemo(() => getCardImageUri(Img), [Img]);
    const fallbackImageUri = useMemo(() => getOriginalImageUri(Img), [Img]);
    const [imageUri, setImageUri] = useState<string | null>(preferredImageUri || fallbackImageUri);

    useEffect(() => {
        setImageUri(preferredImageUri || fallbackImageUri);
    }, [fallbackImageUri, preferredImageUri]);

    const chapterPageHandler = () => {
        if (!chapterUrl) return;

        router.push({
            pathname: '/manga/[...slug]',
            params: {
                slug: [mangaId],
                chapterUrl,
            },
        });
    };

    return (
        <View
            className='overflow-hidden rounded-2xl bg-slate-200 dark:bg-slate-800'
            style={{
                borderWidth: 1,
                borderColor: 'rgba(148, 163, 184, 0.18)',
            }}
        >
            <Pressable
                onPress={() => router.push(`/mangaInfo/${mangaId}`)}
                style={{ width: '100%' }}
            >
                <Image
                    source={{ uri: imageUri || 'https://via.placeholder.com/180x150?text=Manga' }}
                    style={{ width: '100%', aspectRatio: 0.72, backgroundColor: '#CBD5E1' }}
                    resizeMode='cover'
                    resizeMethod='scale'
                    fadeDuration={500}
                    onError={() => {
                        if (imageUri !== fallbackImageUri) {
                            setImageUri(fallbackImageUri);
                        } else {
                            setImageUri(null);
                        }
                    }}
                />
            </Pressable>

            <View className='p-3'>
                <Text
                    numberOfLines={2}
                    className='min-h-[42px] text-[14px] font-semibold leading-5 text-slate-900 dark:text-white'
                >
                    {name}
                </Text>

                <View className='mt-3 flex-row items-center justify-between gap-2'>
                    <Pressable
                        onPress={chapterPageHandler}
                        disabled={!chapterUrl}
                        className='flex-1 rounded-full bg-slate-700 px-3 py-2 dark:bg-slate-600'
                        style={{ opacity: chapterUrl ? 1 : 0.6 }}
                    >
                        <Text
                            numberOfLines={1}
                            className='text-center text-[12px] font-semibold text-white dark:text-white'
                        >
                            {chapter || 'Open Latest'}
                        </Text>
                    </Pressable>
                    <Text
                        className='rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.8px] text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    >
                        Latest
                    </Text>
                </View>
            </View>
        </View>
    )
}

export default React.memo(MangaCard)
