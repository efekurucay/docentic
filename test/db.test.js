import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';

test('openDb creates tables', () => {
  const db = openDb(':memory:');
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')").all().map(r => r.name);
  for (const t of ['pages', 'sessions', 'messages', 'pages_fts']) assert.ok(names.includes(t), t);
});

test('fts search finds page text', () => {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO pages(page_id,url,title,text,lang) VALUES(?,?,?,?,?)")
    .run('p1', '/a', 'Başlık', 'yapay zeka üzerine', 'tr');
  const hit = db.prepare("SELECT page_id FROM pages_fts WHERE pages_fts MATCH ?").all('zeka');
  assert.equal(hit[0].page_id, 'p1');
});
