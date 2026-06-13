import { Stack } from 'expo-router';

export default function MangaLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:  false, // hides the header on all manga screens
      }}
    />
  );
}
