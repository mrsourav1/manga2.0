// import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import mobileAds from 'react-native-google-mobile-ads';
import "../global.css";
import AppOpenAdManager from '../components/AppOpenAdManager';
import AppUpdatePrompt from '../components/AppUpdatePrompt';
import { useColorScheme } from '../hooks/useColorScheme.web';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [adsInitialized, setAdsInitialized] = useState(false);

  useEffect(() => {
    const initializeAds = async () => {
      try {
        if (__DEV__) {
          await mobileAds().setRequestConfiguration({
            testDeviceIdentifiers: ['EMULATOR'],
          });
        }

        await mobileAds().initialize();
        setAdsInitialized(true);
      } catch (error) {
        console.log('Mobile Ads initialization failed', error);
      }
    };

    void initializeAds();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index"
          options={{
          title:"Home",
          headerShown: true,
        }} />
        <Stack.Screen name="manga" options={{
          headerShown: false,
        }} />
        <Stack.Screen name="mangaInfo" options={{
          headerShown: true,
          title:"Description"
        }} />
      </Stack>
      <AppOpenAdManager adsInitialized={adsInitialized} />
      <AppUpdatePrompt />
      {/* <StatusBar style="auto" /> */}
    </ThemeProvider>
  );
}
