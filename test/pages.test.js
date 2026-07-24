import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { upsertPage, getPage, listPages, searchPages } from '../src/pages.js';

test('upsert + get + list + search', () => {
  const db = openDb(':memory:');
  upsertPage(db, { page_id: 'p1', url: '/a', title: 'RLeon', text: 'cihaz üstü yapay zeka macOS', lang: 'tr' });
  upsertPage(db, { page_id: 'p2', url: '/b', title: 'plexcode', text: 'terminal perplexity proxy', lang: 'tr' });
  assert.equal(getPage(db, 'p1').title, 'RLeon');
  assert.equal(listPages(db).length, 2);
  const r = searchPages(db, 'yapay zeka');
  assert.equal(r[0].page_id, 'p1');
  assert.ok(r[0].snippet.length > 0);
});

test('upsert replaces existing', () => {
  const db = openDb(':memory:');
  upsertPage(db, { page_id: 'p1', url: '/a', title: 'v1', text: 'eski', lang: 'tr' });
  upsertPage(db, { page_id: 'p1', url: '/a', title: 'v2', text: 'yeni içerik', lang: 'tr' });
  assert.equal(getPage(db, 'p1').title, 'v2');
  assert.equal(listPages(db).length, 1);
});
