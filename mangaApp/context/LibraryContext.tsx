import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  changeLibraryStatus,
  type LibraryChapterSnapshot,
  type LibraryEntry,
  type LibraryMangaSnapshot,
  type LibraryStatus,
  loadLibraryState,
  recordChapterProgress,
  removeMangaFromLibrary,
  saveMangaToLibrary,
  setChapterReadState,
  syncLibraryManga,
} from '../services/libraryDatabase';

type LibraryContextValue = {
  entries: LibraryEntry[];
  initializing: boolean;
  error: string | null;
  getEntry: (mangaId: string) => LibraryEntry | null;
  isChapterRead: (mangaId: string, chapterUrl: string) => boolean;
  addManga: (snapshot: LibraryMangaSnapshot) => Promise<void>;
  removeManga: (mangaId: string) => Promise<void>;
  updateStatus: (mangaId: string, status: LibraryStatus) => Promise<void>;
  syncManga: (snapshot: LibraryMangaSnapshot) => Promise<void>;
  recordProgress: (
    manga: LibraryMangaSnapshot,
    chapter: LibraryChapterSnapshot
  ) => Promise<void>;
  setChapterRead: (
    mangaId: string,
    chapter: LibraryChapterSnapshot,
    isRead: boolean
  ) => Promise<void>;
  reload: () => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [readChapterKeys, setReadChapterKeys] = useState<Set<string>>(new Set());
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const state = await loadLibraryState();
      setEntries(state.entries);
      setReadChapterKeys(
        new Set(
          state.readChapterUrls.map(
            chapter => `${chapter.manga_id}\u0000${chapter.chapter_url}`
          )
        )
      );
      setError(null);
    } catch (nextError) {
      console.error('Failed to load library', nextError);
      setError('Your library could not be opened.');
    } finally {
      setInitializing(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback(
    async (operation: () => Promise<void>) => {
      await operation();
      await reload();
    },
    [reload]
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      entries,
      initializing,
      error,
      getEntry: mangaId =>
        entries.find(entry => entry.mangaId === mangaId) ?? null,
      isChapterRead: (mangaId, chapterUrl) =>
        readChapterKeys.has(`${mangaId}\u0000${chapterUrl}`),
      addManga: snapshot => mutate(() => saveMangaToLibrary(snapshot)),
      removeManga: mangaId =>
        mutate(() => removeMangaFromLibrary(mangaId)),
      updateStatus: (mangaId, status) =>
        mutate(() => changeLibraryStatus(mangaId, status)),
      syncManga: snapshot => mutate(() => syncLibraryManga(snapshot)),
      recordProgress: (manga, chapter) =>
        mutate(() => recordChapterProgress(manga, chapter)),
      setChapterRead: (mangaId, chapter, isRead) =>
        mutate(() => setChapterReadState(mangaId, chapter, isRead)),
      reload,
    }),
    [entries, error, initializing, mutate, readChapterKeys, reload]
  );

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

export const useLibrary = () => {
  const context = useContext(LibraryContext);

  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider');
  }

  return context;
};
