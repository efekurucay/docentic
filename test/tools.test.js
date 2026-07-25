import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { upsertPage } from '../src/pages.js';
import { makeTools } from '../src/tools.js';

function seed() {
  const db = openDb(':memory:');
  upsertPage(db, { page_id: '/tr/rleon', url: '/tr/rleon', title: 'RLeon', text: 'cihaz üstü yapay zeka', lang: 'tr' });
  return db;
}

test('list_pages returns pages', () => {
  const t = makeTools(seed());
  assert.equal(t.list_pages.run({}).length, 1);
});

test('read_page validates missing id', () => {
  const t = makeTools(seed());
  assert.equal(t.read_page.validate({ page_id: '/yok' }).ok, false);
  assert.ok(t.read_page.run({ page_id: '/tr/rleon' }).text.includes('yapay zeka'));
});

test('search returns hits', () => {
  const t = makeTools(seed());
  assert.equal(t.search.run({ query: 'yapay zeka' })[0].page_id, '/tr/rleon');
});

test('jsonSchema exists for provider', () => {
  const t = makeTools(seed());
  assert.equal(t.search.jsonSchema.type, 'object');
});

test('submit_contact writes with ctx and is not read-only', () => {
  const db = seed();
  const t = makeTools(db);
  assert.equal(t.submit_contact.readOnly, false);
  const r = t.submit_contact.run({ message: 'merhaba', name: 'Ada' }, { siteKey: 's', sessionId: 'x' });
  assert.equal(r.delivered, true);
  const rows = db.prepare('SELECT * FROM contacts').all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].message, 'merhaba');
  assert.equal(rows[0].source, 'assistant');
});

test('read-only tools are marked read-only', () => {
  const t = makeTools(seed());
  assert.equal(t.search.readOnly, true);
  assert.equal(t.read_page.readOnly, true);
});
