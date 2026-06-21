// import 'dotenv/config';

export default {
  expo: {
    name: 'MangaFy',
    slug: 'MangaFy',
    version: '1.1.3',
    orientation: 'portrait',
    scheme: 'com.sourav.mangafy',
    icon: './assets/images/adaptive-first.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon-light-second.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            image: './assets/images/splash-icon-dark-third.png',
            backgroundColor: '#000000',
          },
        },
      ],
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-4808633506022708~9453701227',
          iosAppId: 'ca-app-pub-4808633506022708~7526129007',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      adUnitBanner: process.env.AD_UNIT_BANNER,
      adUnitOpen: process.env.AD_UNIT_OPEN,
      adUnitInterstitial: process.env.AD_UNIT_INTERSTITIAL,
      backendURL: process.env.EXPO_PUBLIC_BACKEND_URL,
      MangaURL: process.env.EXPO_PUBLIC_MANGA_URL,
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mrsourav1.MangaFy',
    },
    android: {
      package: 'com.mrsourav1.MangaFy',
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-first.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
  },
};
