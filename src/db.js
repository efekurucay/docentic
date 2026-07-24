import Database from 'better-sqlite3';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  page_id TEXT PRIMARY KEY, url TEXT, title TEXT, text TEXT, lang TEXT,
  etag TEXT, fetched_at INTEGER
);
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  page_id UNINDEXED, title, text, content='pages', content_rowid='rowid'
);
CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
  INSERT INTO pages_fts(rowid,page_id,title,text) VALUES(new.rowid,new.page_id,new.title,new.text);
END;
CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts,rowid,page_id,title,text) VALUES('delete',old.rowid,old.page_id,old.title,old.text);
END;
CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
  INSERT INTO pages_fts(pages_fts,rowid,page_id,title,text) VALUES('delete',old.rowid,old.page_id,old.title,old.text);
  INSERT INTO pages_fts(rowid,page_id,title,text) VALUES(new.rowid,new.page_id,new.title,new.text);
END;
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, site_key TEXT, created_at INTEGER,
  message_count INTEGER DEFAULT 0, input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0, parent_session_id TEXT
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT, content TEXT, tool_calls TEXT, tool_call_id TEXT, tool_name TEXT, created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
`;

export function openDb(path = ':memory:') {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  return db;
}
