import axios from "axios";

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
    baseURL: backendUrl,
    timeout: 15000,
});

const ensureBackendUrl = () => {
    if (!backendUrl) {
        throw new Error("Backend URL is not configured.");
    }
};

export const getHomePage = async (page: number) => {
    ensureBackendUrl();
    const res = await api.get('/api/manga', {
        params: { page },
    });
    return res.data;
}

export const getChapter = async (url: string) => {
    ensureBackendUrl();
    const res = await api.post('/api/manga/chapter', {
        url,
    });
    return res.data;
}

export const getMangaDetails = async (mangaId: string) => {
    ensureBackendUrl();
    const res = await api.get(`/api/manga/${mangaId}`);
    return res.data;
}

export const searchManga = async (data: string) => {
    ensureBackendUrl();
    const res = await api.post('/api/manga/search', {
        title: data,
    });
    return res.data;
}
