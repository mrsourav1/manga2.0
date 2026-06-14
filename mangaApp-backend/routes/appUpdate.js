import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const router = express.Router();
const updateConfigPath = fileURLToPath(
  new URL('../config/app-update.json', import.meta.url)
);

const isPositiveInteger = (value) =>
  Number.isInteger(value) && value > 0;

router.get('/', async (_req, res) => {
  try {
    const rawConfig = await readFile(updateConfigPath, 'utf8');
    const config = JSON.parse(rawConfig);

    if (
      typeof config.enabled !== 'boolean' ||
      typeof config.latestVersion !== 'string' ||
      !isPositiveInteger(config.latestBuildNumber) ||
      !isPositiveInteger(config.minimumSupportedBuildNumber) ||
      typeof config.downloadUrl !== 'string' ||
      !Array.isArray(config.releaseNotes)
    ) {
      throw new Error('Update configuration is invalid');
    }

    res.set('Cache-Control', 'no-store, max-age=0');
    res.status(200).json(config);
  } catch (error) {
    console.error('Failed to read app update configuration:', error.message);
    res.status(503).json({
      message: 'App update information is temporarily unavailable.',
    });
  }
});

export default router;
