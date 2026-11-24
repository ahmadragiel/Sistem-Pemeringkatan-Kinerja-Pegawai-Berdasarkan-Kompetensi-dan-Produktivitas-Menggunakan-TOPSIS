import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = path.join(projectRoot, 'src', 'db', 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');

let currentDb = null;

export function defaultDbPath() {
  return process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(projectRoot, 'data', 'spk-kinerja.sqlite');
}

export function createDatabase(filename = defaultDbPath()) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON;');
  if (filename !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(schemaSql);
  return db;
}

export function getDb() {
  if (!currentDb) {
    currentDb = createDatabase();
  }
  return currentDb;
}

export function closeDb() {
  if (currentDb) {
    currentDb.close();
    currentDb = null;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function inTransaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
