import Constants from 'expo-constants';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import {
  AdEventType,
  AppOpenAd,
  TestIds,
} from 'react-native-google-mobile-ads';

const MIN_BACKGROUND_TIME_MS = 30 * 1000;
const MIN_SHOW_INTERVAL_MS = 4 * 60 * 60 * 1000;
const MAX_AD_AGE_MS = 4 * 60 * 60 * 1000;

const appOpenAdUnitId = __DEV__
  ? TestIds.APP_OPEN
  : Constants.expoConfig?.extra?.adUnitOpen || process.env.AD_UNIT_OPEN;

type AppOpenAdManagerProps = {
  adsInitialized: boolean;
};

export default function AppOpenAdManager({
  adsInitialized,
}: AppOpenAdManagerProps) {
  useEffect(() => {
    if (
      !adsInitialized ||
      Platform.OS !== 'android' ||
      !appOpenAdUnitId
    ) {
      return;
    }

    let appOpenAd: AppOpenAd | null = null;
    let unsubscribeAdListeners = () => {};
    let adLoadedAt = 0;
    let backgroundedAt = 0;
    let lastShownAt = 0;
    let isLoading = false;
    let isShowing = false;
    let shouldShowWhenLoaded = false;

    const loadFreshAd = () => {
      unsubscribeAdListeners();
      appOpenAd = AppOpenAd.createForAdRequest(appOpenAdUnitId);
      isLoading = true;
      adLoadedAt = 0;

      const unsubscribeLoaded = appOpenAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          isLoading = false;
          adLoadedAt = Date.now();

          if (shouldShowWhenLoaded && AppState.currentState === 'active') {
            showAd();
          }
        }
      );
      const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          isShowing = false;
          shouldShowWhenLoaded = false;
          loadFreshAd();
        }
      );
      const unsubscribeError = appOpenAd.addAdEventListener(
        AdEventType.ERROR,
        error => {
          isLoading = false;
          isShowing = false;
          shouldShowWhenLoaded = false;
          console.log('App-open ad failed to load', error);
        }
      );

      unsubscribeAdListeners = () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };
      appOpenAd.load();
    };

    const showAd = () => {
      const now = Date.now();
      const isFresh = now - adLoadedAt < MAX_AD_AGE_MS;
      const intervalElapsed = now - lastShownAt >= MIN_SHOW_INTERVAL_MS;

      if (!intervalElapsed || isShowing) return;

      if (!appOpenAd?.loaded || !isFresh) {
        shouldShowWhenLoaded = true;

        if (!isLoading) {
          loadFreshAd();
        }

        return;
      }

      shouldShowWhenLoaded = false;
      isShowing = true;
      lastShownAt = now;
      appOpenAd.show();
    };

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextState => {
        if (nextState === 'background') {
          backgroundedAt = Date.now();
          return;
        }

        if (
          nextState === 'active' &&
          backgroundedAt > 0 &&
          Date.now() - backgroundedAt >= MIN_BACKGROUND_TIME_MS
        ) {
          showAd();
        }
      }
    );

    // Preload without interrupting the user's first app session.
    loadFreshAd();

    return () => {
      unsubscribeAdListeners();
      appStateSubscription.remove();
    };
  }, [adsInitialized]);

  return null;
}
