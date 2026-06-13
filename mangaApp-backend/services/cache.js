import redis from 'redis';
import { CACHE_TTL } from '../config/constants.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const memoryCache = new Map();

let client = null;
let connectPromise = null;
let redisDisabled = false;

const getMemoryEntry = (key) => {
  const entry = memoryCache.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }

  return entry.value;
};

const setMemoryEntry = (key, data, ttlSeconds) => {
  memoryCache.set(key, {
    value: data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
};

const ensureRedis = async () => {
  if (redisDisabled) return null;
  if (client?.isOpen) return client;
  if (connectPromise) return connectPromise;

  client = redis.createClient({ url: redisUrl });

  client.on('error', (error) => {
    console.warn('Redis client error, using memory cache:', error.message);
  });

  connectPromise = client
    .connect()
    .then(() => {
      console.log(`Redis cache connected: ${redisUrl}`);
      return client;
    })
    .catch((error) => {
      redisDisabled = true;
      client = null;
      console.warn('Redis unavailable, falling back to memory cache:', error.message);
      return null;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
};

export const getCache = async (key) => {
  const redisClient = await ensureRedis();

  if (redisClient?.isOpen) {
    try {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache read error:', error.message);
    }
  }

  return getMemoryEntry(key);
};

export const setCache = async (key, data, ttlSeconds = CACHE_TTL) => {
  const redisClient = await ensureRedis();

  if (redisClient?.isOpen) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
      return;
    } catch (error) {
      console.error('Cache write error:', error.message);
    }
  }

  setMemoryEntry(key, data, ttlSeconds);
};

export const closeCache = async () => {
  if (!client?.isOpen) return;

  try {
    await client.quit();
  } catch (error) {
    console.warn('Cache shutdown warning:', error.message);
  } finally {
    client = null;
    connectPromise = null;
  }
};
