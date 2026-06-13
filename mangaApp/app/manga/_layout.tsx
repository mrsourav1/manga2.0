// app/manga/_layout.tsx

import { Stack } from 'expo-router';

export default function MangaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // This hides header for all manga screens
      }}
    >
    </Stack>
  );
}
