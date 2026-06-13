import {
  PREFETCH_INTERVAL_MS,
  PREFETCH_PAGES,
} from '../config/constants.js';
import { prefetchHomePages } from '../services/catalogService.js';

let prefetchTimer = null;

const runPrefetchCycle = async () => {
  try {
    await prefetchHomePages(PREFETCH_PAGES);
  } catch (error) {
    console.warn('Prefetch cycle failed:', error.message);
  }
};

export const startPrefetchWorker = () => {
  if (prefetchTimer) return;

  void runPrefetchCycle();

  prefetchTimer = setInterval(() => {
    void runPrefetchCycle();
  }, PREFETCH_INTERVAL_MS);

  if (typeof prefetchTimer.unref === 'function') {
    prefetchTimer.unref();
  }

  console.log(
    `Prefetch worker started for ${PREFETCH_PAGES} homepage page(s) every ${PREFETCH_INTERVAL_MS}ms`
  );
};

export const stopPrefetchWorker = () => {
  if (!prefetchTimer) return;

  clearInterval(prefetchTimer);
  prefetchTimer = null;
};
