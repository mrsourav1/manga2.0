import express from 'express';
import {
  getCoverImage,
  getHomePageMangas,
  getMangaDetails,
  getSourceStatus,
  readChapter,
  searchManga,
} from '../controllers/mangaControllers.js';

const router = express.Router();

router.get('/status/source', getSourceStatus);
router.get('/cover', getCoverImage);
router.get('/', getHomePageMangas);
router.get('/:slug', getMangaDetails);
router.post('/search', searchManga);
router.post('/chapter', readChapter);

export default router;
