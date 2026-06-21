import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  AdEventType,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';

const MIN_SHOW_INTERVAL_MS = __DEV__ ? 30 * 1000 : 8 * 60 * 1000;
const MAX_AD_AGE_MS = 60 * 60 * 1000;

const descriptionInterstitialAdUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : Constants.expoConfig?.extra?.adUnitInterstitial ||
    process.env.AD_UNIT_INTERSTITIAL;

let interstitialAd: InterstitialAd | null = null;
let unsubscribeAdListeners = () => {};
let isLoading = false;
let isShowing = false;
let loadedAt = 0;
let lastShownAt = 0;
let pendingShowResolver: ((shown: boolean) => void) | null = null;

const canUseDescriptionInterstitial = () =>
  Platform.OS === 'android' && Boolean(descriptionInterstitialAdUnitId);

const isFresh = () => Date.now() - loadedAt < MAX_AD_AGE_MS;

const resolvePendingShow = (shown: boolean) => {
  pendingShowResolver?.(shown);
  pendingShowResolver = null;
};

export const preloadDescriptionInterstitial = () => {
  if (!canUseDescriptionInterstitial()) return;
  if (isLoading || (interstitialAd?.loaded && isFresh())) return;

  unsubscribeAdListeners();
  interstitialAd = InterstitialAd.createForAdRequest(
    descriptionInterstitialAdUnitId
  );
  isLoading = true;
  loadedAt = 0;

  const unsubscribeLoaded = interstitialAd.addAdEventListener(
    AdEventType.LOADED,
    () => {
      isLoading = false;
      loadedAt = Date.now();
      console.log('Description interstitial loaded');
    }
  );

  const unsubscribeClosed = interstitialAd.addAdEventListener(
    AdEventType.CLOSED,
    () => {
      isShowing = false;
      resolvePendingShow(true);
      preloadDescriptionInterstitial();
    }
  );

  const unsubscribeError = interstitialAd.addAdEventListener(
    AdEventType.ERROR,
    error => {
      isLoading = false;
      isShowing = false;
      console.log('Description interstitial failed', error);
      resolvePendingShow(false);
    }
  );

  unsubscribeAdListeners = () => {
    unsubscribeLoaded();
    unsubscribeClosed();
    unsubscribeError();
  };

  interstitialAd.load();
};

export const showDescriptionInterstitialIfReady = async () => {
  if (!canUseDescriptionInterstitial()) return false;

  const intervalElapsed = Date.now() - lastShownAt >= MIN_SHOW_INTERVAL_MS;

  if (
    !intervalElapsed ||
    isShowing ||
    !interstitialAd?.loaded ||
    !isFresh()
  ) {
    preloadDescriptionInterstitial();
    return false;
  }

  isShowing = true;
  lastShownAt = Date.now();

  return new Promise<boolean>(resolve => {
    pendingShowResolver = resolve;

    try {
      interstitialAd?.show();
    } catch (error) {
      isShowing = false;
      console.log('Description interstitial show failed', error);
      resolvePendingShow(false);
      preloadDescriptionInterstitial();
    }
  });
};
