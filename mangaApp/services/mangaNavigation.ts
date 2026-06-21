import { router } from 'expo-router';
import {
  preloadDescriptionInterstitial,
  showDescriptionInterstitialIfReady,
} from './descriptionInterstitial';

export const openMangaDescription = async (mangaId: string) => {
  await showDescriptionInterstitialIfReady();
  router.push(`/mangaInfo/${mangaId}`);
  preloadDescriptionInterstitial();
};
