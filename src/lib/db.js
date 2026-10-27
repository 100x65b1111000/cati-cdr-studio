import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// node:sqlite ships with Node 22.5+, so there is no native module to build on the
// Windows box this runs on. See README for the Node floor this imposes.
const DB_PATH = process.env.DB_PATH || 'data/cdr.sqlite';

// Retain enough uploads that a bad replace is undoable, then stop. Each upload holds
// every call row, so this is the only thing keeping the file from growing forever.
const KEEP_UPLOADS = 5;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS uploads (
  id          INTEGER PRIMARY KEY,
  filename    TEXT    NOT NULL,
  source      TEXT    NOT NULL,
  row_count   INTEGER NOT NULL,
  uploaded_at TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calls (
  id           INTEGER PRIMARY KEY,
  upload_id    INTEGER NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
  extension    TEXT    NOT NULL,
  start_time   TEXT    NOT NULL,
  end_time     TEXT    NOT NULL,
  duration_sec INTEGER NOT NULL,
  direction    TEXT    NOT NULL,
  response     TEXT    NOT NULL,
  region       TEXT    NOT NULL,
  raw_json     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_ext_time ON calls(extension, start_time);
-- Exactly one active upload, enforced by the engine rather than by remembering to
-- check it in every caller.
CREATE UNIQUE INDEX IF NOT EXISTS uploads_one_active ON uploads(active) WHERE active = 1;
`;

// next dev reloads modules constantly; without this each reload opens a fresh handle
// and the WAL gets two writers.
const holder = globalThis.__cdrDb ??= { db: null };

export function getDb() {
  if (holder.db) return holder.db;
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec(SCHEMA);
  holder.db = db;
  return db;
}

function inTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Replaces the dataset in one transaction: the new upload is written, made active, and
 * only then are the uploads it displaced dropped. A failure at any point leaves the
 * previously active set untouched rather than half-swapped, because this is shared team
 * data and a torn replace takes everyone's report down with it.
 */
export function replaceDataset({ filename, source, rows, calls, skipped }) {
  const db = getDb();
  return inTransaction(db, () => {
    const { lastInsertRowid: uploadId } = db
      .prepare('INSERT INTO uploads (filename, source, row_count, uploaded_at, active) VALUES (?, ?, ?, ?, 0)')
      .run(filename, source, rows.length, new Date().toISOString());

    const insert = db.prepare(
      'INSERT INTO calls (upload_id, extension, start_time, end_time, duration_sec, direction, response, region, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const call of calls) {
      insert.run(
        uploadId,
        call.extension,
        call.start_time.toISOString(),
        call.end_time.toISOString(),
        call.duration,
        call.direction,
        call.response,
        call.region,
        JSON.stringify(call.raw)
      );
    }

    db.prepare('UPDATE uploads SET active = 0 WHERE active = 1').run();
    db.prepare('UPDATE uploads SET active = 1 WHERE id = ?').run(uploadId);
    db.prepare('DELETE FROM uploads WHERE id NOT IN (SELECT id FROM uploads ORDER BY id DESC LIMIT ?)').run(KEEP_UPLOADS);

    return { uploadId: Number(uploadId), rowCount: rows.length, kept: calls.length, skipped };
  });
}

export function activeRows() {
  const db = getDb();
  const active = db.prepare('SELECT id, filename, source, row_count, uploaded_at FROM uploads WHERE active = 1').get();
  if (!active) return { upload: null, rows: [], history: [] };

  const rows = db
    .prepare('SELECT raw_json FROM calls WHERE upload_id = ? ORDER BY start_time, id')
    .all(active.id)
    .map((r) => JSON.parse(r.raw_json));

  // History excludes the live one: it is only ever a list of things to go back to.
  const history = db
    .prepare('SELECT id, filename, source, row_count AS rowCount, uploaded_at AS uploadedAt FROM uploads WHERE active = 0 ORDER BY id DESC')
    .all();

  return {
    upload: {
      id: active.id,
      filename: active.filename,
      source: active.source,
      rowCount: active.row_count,
      uploadedAt: active.uploaded_at
    },
    rows,
    history
  };
}

/** Points the dataset at a retained upload and discards the one it displaces. */
export function activateUpload(id) {
  const db = getDb();
  const target = db.prepare('SELECT id FROM uploads WHERE id = ?').get(id);
  if (!target) return null;
  return inTransaction(db, () => {
    db.prepare('UPDATE uploads SET active = 0 WHERE active = 1').run();
    db.prepare('UPDATE uploads SET active = 1 WHERE id = ?').run(id);
    return activeRows();
  });
}

export function clearDataset() {
  const db = getDb();
  // Child rows go with them via ON DELETE CASCADE; the pragma is set at connect.
  db.prepare('DELETE FROM uploads').run();
}
