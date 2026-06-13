import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

type Props = {
    name: string;
    date: string | null;
    url: string;
    mangaId: string;
};

const ChapterCard = ({ name, date, url, mangaId }: Props) => {
    const mangaPageHandler = (chapterUrl: string) => {
        router.push({
            pathname: '/manga/[...slug]',
            params: {
                slug: [mangaId],
                chapterUrl,
            },
        });
    };
    return (
        <Pressable
            onPress={() => mangaPageHandler(url)}
            className="m-1 rounded-lg bg-slate-700 p-4"
        >
            <Text className="text-white underline font-bold">
                {name}
            </Text>
            {date ? (
                <Text className="mt-2 self-end text-xs text-slate-300">
                    Updated at: {date}
                </Text>
            ) : null}
        </Pressable>
    );
};

export default React.memo(ChapterCard);
