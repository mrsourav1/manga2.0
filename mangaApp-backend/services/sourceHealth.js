import { SOURCE_CONFIGS, SUPPORTED_SOURCE_NAMES } from '../config/constants.js';

const sourceStates = new Map();

const getInitialState = (name) => ({
  name,
  label: SOURCE_CONFIGS[name]?.label || name,
  consecutiveFailures: 0,
  lastError: null,
  lastErrorAt: null,
  lastSuccessAt: null,
  status: 'idle',
});

const ensureSourceState = (name) => {
  if (!sourceStates.has(name)) {
    sourceStates.set(name, getInitialState(name));
  }

  return sourceStates.get(name);
};

export const markSourceSuccess = (name) => {
  const source = ensureSourceState(name);
  source.consecutiveFailures = 0;
  source.lastError = null;
  source.lastSuccessAt = new Date().toISOString();
  source.status = 'healthy';
};

export const markSourceFailure = (name, error) => {
  const source = ensureSourceState(name);
  source.consecutiveFailures += 1;
  source.lastError = error?.message || 'Unknown error';
  source.lastErrorAt = new Date().toISOString();
  source.status = 'degraded';
};

export const getSourceHealth = (name) => ({
  ...ensureSourceState(name),
});

export const getAllSourceHealth = () =>
  SUPPORTED_SOURCE_NAMES.map((name) => getSourceHealth(name));
