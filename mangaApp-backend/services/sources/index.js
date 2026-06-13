import { SOURCE_CONFIGS, SUPPORTED_SOURCE_NAMES } from '../../config/constants.js';
import { createAsuraSource } from './asura.js';
import { createMadaraSource } from './madara.js';
import { createMangaBuddySource } from './mangabuddy.js';

const createSource = (config) => {
  if (config.adapter === 'asura') {
    return createAsuraSource(config);
  }

  if (config.adapter === 'mangabuddy') {
    return createMangaBuddySource(config);
  }

  return createMadaraSource(config);
};

export const sources = SUPPORTED_SOURCE_NAMES.map((name) => createSource(SOURCE_CONFIGS[name]));

export const getSourceByName = (name) => sources.find((source) => source.name === name) || null;

export const getSourceForUrl = (url) =>
  sources.find((source) => source.matchesUrl(url)) || null;
