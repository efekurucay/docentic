import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { upsertPage } from '../src/pages.js';
import { makeTools } from '../src/tools.js';
import { dispatchOne, dispatchAll } from '../src/dispatch.js';

function tools() {
  const db = openDb(':memory:');
  upsertPage(db, { page_id: '/a', url: '/a', title: 'A', text: 'metin bir', lang: 'tr' });
  return makeTools(db);
}

test('unknown tool → error, no throw', () => {
  const r = dispatchOne(tools(), { name: 'nope', args: {} });
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown tool/);
});

test('validation failure → error', () => {
  const r = dispatchOne(tools(), { name: 'read_page', args: { page_id: '/yok' } });
  assert.equal(r.ok, false);
});

test('dispatchAll runs in parallel preserving order', async () => {
  const results = await dispatchAll(tools(), [
    { name: 'search', args: { query: 'metin' } },
    { name: 'list_pages', args: {} },
  ]);
  assert.equal(results.length, 2);
  assert.equal(results[0].ok, true);
});
