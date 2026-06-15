import type {
  LibraryChapterSnapshot,
  LibraryMangaSnapshot,
} from './libraryDatabase';

type ChapterLike = {
  title?: string | null;
  url?: string | null;
  chapterNumber?: number | null;
};

type MangaLike = {
  mangaId?: string | null;
  title?: string | null;
  cover?: string | null;
  chapters?: ChapterLike[] | null;
};

export const extractChapterNumber = (
  title?: string | null,
  url?: string | null
) => {
  const combined = `${title || ''} ${url || ''}`;
  const match = combined.match(
    /(?:chapter|chap|ch)[-_/\s:]*(\d+(?:\.\d+)?)/i
  );

  if (!match) return null;

  const chapterNumber = Number.parseFloat(match[1]);
  return Number.isFinite(chapterNumber) ? chapterNumber : null;
};

export const toChapterSnapshot = (
  chapter: ChapterLike
): LibraryChapterSnapshot | null => {
  if (!chapter.url) return null;

  return {
    title: chapter.title?.trim() || 'Chapter',
    url: chapter.url,
    chapterNumber:
      chapter.chapterNumber ?? extractChapterNumber(chapter.title, chapter.url),
  };
};

export const toLibrarySnapshot = (
  manga: MangaLike
): LibraryMangaSnapshot | null => {
  if (!manga.mangaId || !manga.title) return null;

  const chapters = (manga.chapters || [])
    .map(toChapterSnapshot)
    .filter((chapter): chapter is LibraryChapterSnapshot => chapter !== null);

  return {
    mangaId: manga.mangaId,
    title: manga.title,
    cover: manga.cover || null,
    latestChapter: chapters[chapters.length - 1] || null,
    chapters,
  };
};
