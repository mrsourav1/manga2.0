import * as SQLite from 'expo-sqlite';

export type LibraryStatus = 'reading' | 'completed' | 'on-hold' | 'dropped';

export type LibraryChapterSnapshot = {
  title: string;
  url: string;
  chapterNumber: number | null;
};

export type LibraryMangaSnapshot = {
  mangaId: string;
  title: string;
  cover: string | null;
  latestChapter: LibraryChapterSnapshot | null;
  chapters?: LibraryChapterSnapshot[];
};

export type LibraryEntry = {
  mangaId: string;
  title: string;
  cover: string | null;
  status: LibraryStatus;
  addedAt: number;
  updatedAt: number;
  lastCheckedAt: number | null;
  lastReadAt: number | null;
  lastReadChapterUrl: string | null;
  lastReadChapterTitle: string | null;
  lastReadChapterNumber: number | null;
  latestChapterUrl: string | null;
  latestChapterTitle: string | null;
  latestChapterNumber: number | null;
  unreadCount: number;
};

export type ReadingHistoryEntry = {
  mangaId: string;
  title: string;
  cover: string | null;
  updatedAt: number;
  lastReadAt: number;
  lastReadChapterUrl: string;
  lastReadChapterTitle: string;
  lastReadChapterNumber: number | null;
  latestChapterUrl: string | null;
  latestChapterTitle: string | null;
  latestChapterNumber: number | null;
};

type LibraryEntryRow = {
  manga_id: string;
  title: string;
  cover_url: string | null;
  status: LibraryStatus;
  added_at: number;
  updated_at: number;
  last_checked_at: number | null;
  last_read_at: number | null;
  last_read_chapter_url: string | null;
  last_read_chapter_title: string | null;
  last_read_chapter_number: number | null;
  latest_chapter_url: string | null;
  latest_chapter_title: string | null;
  latest_chapter_number: number | null;
  unread_count: number;
};

type ReadingHistoryRow = {
  manga_id: string;
  title: string;
  cover_url: string | null;
  updated_at: number;
  last_read_at: number;
  last_read_chapter_url: string;
  last_read_chapter_title: string;
  last_read_chapter_number: number | null;
  latest_chapter_url: string | null;
  latest_chapter_title: string | null;
  latest_chapter_number: number | null;
};

type ReadChapterRow = {
  manga_id: string;
  chapter_url: string;
  chapter_number: number | null;
};

const DATABASE_NAME = 'mangafy-library.db';
const DATABASE_VERSION = 2;
let initializedDatabasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const migrateDatabase = async (database: SQLite.SQLiteDatabase) => {
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const version = versionRow?.user_version ?? 0;

  if (version >= DATABASE_VERSION) return;

  if (version < 2) {
    await database.execAsync(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE IF NOT EXISTS reading_history (
        manga_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        cover_url TEXT,
        updated_at INTEGER NOT NULL,
        last_read_at INTEGER NOT NULL,
        last_read_chapter_url TEXT NOT NULL,
        last_read_chapter_title TEXT NOT NULL,
        last_read_chapter_number REAL,
        latest_chapter_url TEXT,
        latest_chapter_title TEXT,
        latest_chapter_number REAL
      );

      INSERT OR IGNORE INTO reading_history (
        manga_id, title, cover_url, updated_at, last_read_at,
        last_read_chapter_url, last_read_chapter_title, last_read_chapter_number,
        latest_chapter_url, latest_chapter_title, latest_chapter_number
      )
      SELECT
        manga_id,
        title,
        cover_url,
        COALESCE(updated_at, last_read_at, added_at),
        last_read_at,
        last_read_chapter_url,
        COALESCE(last_read_chapter_title, 'Chapter'),
        last_read_chapter_number,
        latest_chapter_url,
        latest_chapter_title,
        latest_chapter_number
      FROM library_entries
      WHERE last_read_at IS NOT NULL
        AND last_read_chapter_url IS NOT NULL;

      DROP TABLE IF EXISTS read_chapters_migration;

      CREATE TABLE read_chapters_migration (
        manga_id TEXT NOT NULL,
        chapter_url TEXT NOT NULL,
        chapter_title TEXT NOT NULL,
        chapter_number REAL,
        read_at INTEGER NOT NULL,
        PRIMARY KEY (manga_id, chapter_url)
      );

      INSERT OR IGNORE INTO read_chapters_migration (
        manga_id, chapter_url, chapter_title, chapter_number, read_at
      )
      SELECT
        manga_id,
        chapter_url,
        chapter_title,
        chapter_number,
        read_at
      FROM read_chapters;

      DROP TABLE read_chapters;
      ALTER TABLE read_chapters_migration RENAME TO read_chapters;

      CREATE INDEX IF NOT EXISTS read_chapters_manga_idx
        ON read_chapters(manga_id, read_at DESC);
      CREATE INDEX IF NOT EXISTS reading_history_last_read_idx
        ON reading_history(last_read_at DESC);

      PRAGMA user_version = ${DATABASE_VERSION};
      PRAGMA foreign_keys = ON;
    `);
  }
};

const getDatabase = async () => {
  if (!initializedDatabasePromise) {
    initializedDatabasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS library_entries (
          manga_id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          cover_url TEXT,
          status TEXT NOT NULL DEFAULT 'reading'
            CHECK (status IN ('reading', 'completed', 'on-hold', 'dropped')),
          added_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_checked_at INTEGER,
          last_read_at INTEGER,
          last_read_chapter_url TEXT,
          last_read_chapter_title TEXT,
          last_read_chapter_number REAL,
          latest_chapter_url TEXT,
          latest_chapter_title TEXT,
          latest_chapter_number REAL,
          unread_count INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS read_chapters (
          manga_id TEXT NOT NULL,
          chapter_url TEXT NOT NULL,
          chapter_title TEXT NOT NULL,
          chapter_number REAL,
          read_at INTEGER NOT NULL,
          PRIMARY KEY (manga_id, chapter_url)
        );

        CREATE TABLE IF NOT EXISTS reading_history (
          manga_id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          cover_url TEXT,
          updated_at INTEGER NOT NULL,
          last_read_at INTEGER NOT NULL,
          last_read_chapter_url TEXT NOT NULL,
          last_read_chapter_title TEXT NOT NULL,
          last_read_chapter_number REAL,
          latest_chapter_url TEXT,
          latest_chapter_title TEXT,
          latest_chapter_number REAL
        );

        CREATE INDEX IF NOT EXISTS library_entries_last_read_idx
          ON library_entries(last_read_at DESC);
        CREATE INDEX IF NOT EXISTS read_chapters_manga_idx
          ON read_chapters(manga_id, read_at DESC);
        CREATE INDEX IF NOT EXISTS reading_history_last_read_idx
          ON reading_history(last_read_at DESC);
      `);
      await migrateDatabase(database);
      return database;
    })();
  }

  return initializedDatabasePromise;
};

const mapEntry = (row: LibraryEntryRow): LibraryEntry => ({
  mangaId: row.manga_id,
  title: row.title,
  cover: row.cover_url,
  status: row.status,
  addedAt: row.added_at,
  updatedAt: row.updated_at,
  lastCheckedAt: row.last_checked_at,
  lastReadAt: row.last_read_at,
  lastReadChapterUrl: row.last_read_chapter_url,
  lastReadChapterTitle: row.last_read_chapter_title,
  lastReadChapterNumber: row.last_read_chapter_number,
  latestChapterUrl: row.latest_chapter_url,
  latestChapterTitle: row.latest_chapter_title,
  latestChapterNumber: row.latest_chapter_number,
  unreadCount: row.unread_count,
});

const mapHistoryEntry = (row: ReadingHistoryRow): ReadingHistoryEntry => ({
  mangaId: row.manga_id,
  title: row.title,
  cover: row.cover_url,
  updatedAt: row.updated_at,
  lastReadAt: row.last_read_at,
  lastReadChapterUrl: row.last_read_chapter_url,
  lastReadChapterTitle: row.last_read_chapter_title,
  lastReadChapterNumber: row.last_read_chapter_number,
  latestChapterUrl: row.latest_chapter_url,
  latestChapterTitle: row.latest_chapter_title,
  latestChapterNumber: row.latest_chapter_number,
});

const getReadChapters = async (
  database: SQLite.SQLiteDatabase,
  mangaId: string
) => {
  return database.getAllAsync<{
    chapter_url: string;
    chapter_number: number | null;
  }>(
    'SELECT chapter_url, chapter_number FROM read_chapters WHERE manga_id = ?',
    mangaId
  );
};

const countUnreadChapters = (
  chapters: LibraryChapterSnapshot[] | undefined,
  readChapters: {
    chapter_url: string;
    chapter_number: number | null;
  }[]
) => {
  if (!chapters) return null;

  const readUrls = new Set(readChapters.map(chapter => chapter.chapter_url));
  const readNumbers = new Set(
    readChapters
      .map(chapter => chapter.chapter_number)
      .filter((chapterNumber): chapterNumber is number => chapterNumber != null)
  );

  return chapters.reduce((count, chapter) => {
    const isRead =
      readUrls.has(chapter.url) ||
      (chapter.chapterNumber != null && readNumbers.has(chapter.chapterNumber));

    return count + (isRead ? 0 : 1);
  }, 0);
};

export const loadLibraryState = async () => {
  const database = await getDatabase();
  const [entryRows, historyRows, readRows] = await Promise.all([
    database.getAllAsync<LibraryEntryRow>(
      `SELECT * FROM library_entries
       ORDER BY COALESCE(last_read_at, added_at) DESC, title COLLATE NOCASE`
    ),
    database.getAllAsync<ReadingHistoryRow>(
      `SELECT * FROM reading_history
       ORDER BY last_read_at DESC, title COLLATE NOCASE`
    ),
    database.getAllAsync<ReadChapterRow>(
      'SELECT manga_id, chapter_url, chapter_number FROM read_chapters'
    ),
  ]);

  return {
    entries: entryRows.map(mapEntry),
    historyEntries: historyRows.map(mapHistoryEntry),
    readChapterUrls: readRows,
  };
};

export const saveMangaToLibrary = async (
  snapshot: LibraryMangaSnapshot,
  status: LibraryStatus = 'reading'
) => {
  const database = await getDatabase();
  const now = Date.now();
  const latest = snapshot.latestChapter;

  await database.withExclusiveTransactionAsync(async transaction => {
    const history = await transaction.getFirstAsync<ReadingHistoryRow>(
      'SELECT * FROM reading_history WHERE manga_id = ?',
      snapshot.mangaId
    );
    const readChapters = await getReadChapters(transaction, snapshot.mangaId);
    const unreadCount = countUnreadChapters(snapshot.chapters, readChapters);

    await transaction.runAsync(
      `INSERT INTO library_entries (
        manga_id, title, cover_url, status, added_at, updated_at, last_checked_at,
        last_read_at, last_read_chapter_url, last_read_chapter_title,
        last_read_chapter_number,
        latest_chapter_url, latest_chapter_title, latest_chapter_number, unread_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manga_id) DO UPDATE SET
        title = excluded.title,
        cover_url = COALESCE(excluded.cover_url, library_entries.cover_url),
        updated_at = excluded.updated_at,
        last_checked_at = excluded.last_checked_at,
        last_read_at = COALESCE(library_entries.last_read_at, excluded.last_read_at),
        last_read_chapter_url = COALESCE(library_entries.last_read_chapter_url, excluded.last_read_chapter_url),
        last_read_chapter_title = COALESCE(library_entries.last_read_chapter_title, excluded.last_read_chapter_title),
        last_read_chapter_number = COALESCE(library_entries.last_read_chapter_number, excluded.last_read_chapter_number),
        latest_chapter_url = excluded.latest_chapter_url,
        latest_chapter_title = excluded.latest_chapter_title,
        latest_chapter_number = excluded.latest_chapter_number,
        unread_count = CASE
          WHEN ? IS NULL THEN library_entries.unread_count
          ELSE excluded.unread_count
        END`,
      snapshot.mangaId,
      snapshot.title,
      snapshot.cover,
      status,
      now,
      now,
      now,
      history?.last_read_at ?? null,
      history?.last_read_chapter_url ?? null,
      history?.last_read_chapter_title ?? null,
      history?.last_read_chapter_number ?? null,
      latest?.url ?? null,
      latest?.title ?? null,
      latest?.chapterNumber ?? null,
      unreadCount ?? 0,
      unreadCount
    );
  });
};

export const removeMangaFromLibrary = async (mangaId: string) => {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM library_entries WHERE manga_id = ?', mangaId);
};

export const changeLibraryStatus = async (
  mangaId: string,
  status: LibraryStatus
) => {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE library_entries SET status = ?, updated_at = ? WHERE manga_id = ?',
    status,
    Date.now(),
    mangaId
  );
};

export const syncLibraryManga = async (snapshot: LibraryMangaSnapshot) => {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ manga_id: string }>(
    'SELECT manga_id FROM library_entries WHERE manga_id = ?',
    snapshot.mangaId
  );

  if (!existing) return;
  await saveMangaToLibrary(snapshot);
};

export const recordChapterProgress = async (
  manga: LibraryMangaSnapshot,
  chapter: LibraryChapterSnapshot
) => {
  const database = await getDatabase();
  const now = Date.now();
  const latest = manga.latestChapter;

  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.runAsync(
      `INSERT INTO reading_history (
        manga_id, title, cover_url, updated_at, last_read_at,
        last_read_chapter_url, last_read_chapter_title, last_read_chapter_number,
        latest_chapter_url, latest_chapter_title, latest_chapter_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manga_id) DO UPDATE SET
        title = excluded.title,
        cover_url = COALESCE(excluded.cover_url, reading_history.cover_url),
        updated_at = excluded.updated_at,
        last_read_at = excluded.last_read_at,
        last_read_chapter_url = excluded.last_read_chapter_url,
        last_read_chapter_title = excluded.last_read_chapter_title,
        last_read_chapter_number = excluded.last_read_chapter_number,
        latest_chapter_url = COALESCE(excluded.latest_chapter_url, reading_history.latest_chapter_url),
        latest_chapter_title = COALESCE(excluded.latest_chapter_title, reading_history.latest_chapter_title),
        latest_chapter_number = COALESCE(excluded.latest_chapter_number, reading_history.latest_chapter_number)`,
      manga.mangaId,
      manga.title,
      manga.cover,
      now,
      now,
      chapter.url,
      chapter.title,
      chapter.chapterNumber,
      latest?.url ?? null,
      latest?.title ?? null,
      latest?.chapterNumber ?? null
    );

    const result = await transaction.runAsync(
      `INSERT OR IGNORE INTO read_chapters (
        manga_id, chapter_url, chapter_title, chapter_number, read_at
      ) VALUES (?, ?, ?, ?, ?)`,
      manga.mangaId,
      chapter.url,
      chapter.title,
      chapter.chapterNumber,
      now
    );

    await transaction.runAsync(
      `UPDATE library_entries SET
        title = ?,
        cover_url = COALESCE(?, cover_url),
        last_read_at = ?,
        last_read_chapter_url = ?,
        last_read_chapter_title = ?,
        last_read_chapter_number = ?,
        latest_chapter_url = COALESCE(?, latest_chapter_url),
        latest_chapter_title = COALESCE(?, latest_chapter_title),
        latest_chapter_number = COALESCE(?, latest_chapter_number),
        unread_count = MAX(unread_count - ?, 0),
        updated_at = ?
      WHERE manga_id = ?`,
      manga.title,
      manga.cover,
      now,
      chapter.url,
      chapter.title,
      chapter.chapterNumber,
      latest?.url ?? null,
      latest?.title ?? null,
      latest?.chapterNumber ?? null,
      result.changes > 0 ? 1 : 0,
      now,
      manga.mangaId
    );
  });
};

export const setChapterReadState = async (
  mangaId: string,
  chapter: LibraryChapterSnapshot,
  isRead: boolean
) => {
  const database = await getDatabase();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async transaction => {
    if (isRead) {
      const result = await transaction.runAsync(
        `INSERT OR IGNORE INTO read_chapters (
          manga_id, chapter_url, chapter_title, chapter_number, read_at
        ) VALUES (?, ?, ?, ?, ?)`,
        mangaId,
        chapter.url,
        chapter.title,
        chapter.chapterNumber,
        now
      );

      if (result.changes > 0) {
        await transaction.runAsync(
          `UPDATE library_entries
           SET unread_count = MAX(unread_count - 1, 0), updated_at = ?
           WHERE manga_id = ?`,
          now,
          mangaId
        );
      }
      return;
    }

    const result = await transaction.runAsync(
      'DELETE FROM read_chapters WHERE manga_id = ? AND chapter_url = ?',
      mangaId,
      chapter.url
    );

    if (result.changes > 0) {
      await transaction.runAsync(
        `UPDATE library_entries
         SET unread_count = unread_count + 1, updated_at = ?
         WHERE manga_id = ?`,
        now,
        mangaId
      );
    }
  });
};
