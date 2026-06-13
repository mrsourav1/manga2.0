import {
  getChapterData,
  getHomePageData,
  getMangaDetailsData,
  searchMangaData,
  SourceUnavailableError,
} from "../services/catalogService.js";
import { fetchProxyImage, isSupportedProxyImageUrl } from "../services/imageProxy.js";
import { getAllSourceHealth } from "../services/sourceHealth.js";

const sendSourceUnavailable = (res, error) =>
    res.status(503).json({
        error: `${error.sourceName} source unavailable`,
        source: error.sourceName,
        health: getAllSourceHealth(),
    });

export const getMangaDetails = async (req, res) => {
    try {
        const { slug: mangaId } = req.params;
        const mangaData = await getMangaDetailsData(mangaId);
        if (!mangaData) return res.status(404).json({ error: 'Manga not found' });
        res.json(mangaData);
    } catch (error) {
        if (error instanceof SourceUnavailableError) {
            return sendSourceUnavailable(res, error);
        }
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getHomePageMangas = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const homeData = await getHomePageData(page);
        if (!homeData || homeData.mangas.length === 0) {
            return res.status(404).json({ error: 'Page not found' });
        }
        res.json(homeData);
    } catch (error) {
        if (error instanceof SourceUnavailableError) {
            return sendSourceUnavailable(res, error);
        }
        console.error('Home API Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const searchManga = async (req, res) => {
    try {
        const { title } = req.body;
        if (!title?.trim()) {
            return res.status(400).json({ error: 'Search title is required' });
        }

        const response = await searchMangaData(title);
        return res.status(200).json(response);
    } catch (error) {
        if (error instanceof SourceUnavailableError) {
            return sendSourceUnavailable(res, error);
        }
        console.error('Search API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const readChapter = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ message: "URL rquired" });

        const data = await getChapterData(url);
        if (!data || data.images?.length === 0) {
            return res.status(404).json({ error: "Chapter not found" });
        }

        return res.status(200).json(data);
    } catch (error) {
        if (error instanceof SourceUnavailableError) {
            return sendSourceUnavailable(res, error);
        }
        console.error('Chapter API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

export const getSourceStatus = async (_req, res) => {
    return res.status(200).json({
        sources: getAllSourceHealth(),
    });
};

export const getCoverImage = async (req, res) => {
    try {
        const url = typeof req.query.url === 'string' ? req.query.url : null;

        if (!url) {
            return res.status(400).json({ error: 'Image URL is required' });
        }

        if (!isSupportedProxyImageUrl(url)) {
            return res.status(400).json({ error: 'Image host is not supported' });
        }

        const image = await fetchProxyImage(url);
        if (!image) {
            return res.status(404).json({ error: 'Image not found' });
        }

        res.setHeader('Content-Type', image.contentType);
        res.setHeader('Cache-Control', image.cacheControl);
        return res.status(200).send(image.body);
    } catch (error) {
        console.error('Cover proxy error:', error);
        return res.status(502).json({ error: 'Could not fetch cover image' });
    }
};
