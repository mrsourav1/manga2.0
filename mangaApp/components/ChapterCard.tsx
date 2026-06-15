import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Props = {
    name: string;
    date: string | null;
    isRead: boolean;
    onPress: () => void;
    onToggleRead: () => void;
};

const ChapterCard = ({
    name,
    date,
    isRead,
    onPress,
    onToggleRead,
}: Props) => {
    return (
        <View
            className="m-1 flex-row items-center rounded-xl bg-slate-700"
            style={{ opacity: isRead ? 0.68 : 1 }}
        >
            <Pressable
                onPress={onPress}
                style={{ flex: 1, padding: 16 }}
            >
                <Text
                    numberOfLines={2}
                    className="font-bold text-white"
                    style={{ textDecorationLine: isRead ? 'line-through' : 'none' }}
                >
                    {name}
                </Text>
                {date ? (
                    <Text className="mt-2 text-xs text-slate-300">
                        Updated at: {date}
                    </Text>
                ) : null}
            </Pressable>
            <Pressable
                accessibilityLabel={isRead ? 'Mark chapter unread' : 'Mark chapter read'}
                onPress={onToggleRead}
                style={{
                    width: 48,
                    height: 48,
                    marginRight: 8,
                    borderRadius: 16,
                    backgroundColor: isRead ? '#166534' : '#1e293b',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Ionicons
                    name={isRead ? 'checkmark-circle' : 'ellipse-outline'}
                    size={23}
                    color={isRead ? '#bbf7d0' : '#cbd5e1'}
                />
            </Pressable>
        </View>
    );
};

export default React.memo(ChapterCard);
