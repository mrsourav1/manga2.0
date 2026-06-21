import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type BottomNavigationProps = {
  active: 'home' | 'history' | 'library';
};

type NavigationTarget = Parameters<typeof router.replace>[0];

const items = [
  {
    key: 'home' as const,
    label: 'Home',
    icon: 'compass-outline' as const,
    activeIcon: 'compass' as const,
    path: '/' as const,
  },
  {
    key: 'history' as const,
    label: 'History',
    icon: 'time-outline' as const,
    activeIcon: 'time' as const,
    path: '/history' as const,
  },
  {
    key: 'library' as const,
    label: 'Library',
    icon: 'library-outline' as const,
    activeIcon: 'library' as const,
    path: '/library' as const,
  },
];

export default function BottomNavigation({ active }: BottomNavigationProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: 'rgba(148, 163, 184, 0.16)',
        backgroundColor: '#0f172a',
        paddingHorizontal: 18,
        paddingTop: 9,
        paddingBottom: 10,
      }}
    >
      {items.map(item => {
        const selected = item.key === active;

        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) {
                router.replace(item.path as NavigationTarget);
              }
            }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              minHeight: 46,
            }}
          >
            <Ionicons
              name={selected ? item.activeIcon : item.icon}
              size={22}
              color={selected ? '#60a5fa' : '#94a3b8'}
            />
            <Text
              style={{
                color: selected ? '#bfdbfe' : '#94a3b8',
                fontSize: 11,
                fontWeight: selected ? '800' : '600',
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
