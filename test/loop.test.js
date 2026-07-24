import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { upsertPage } from '../src/pages.js';
import { makeTools } from '../src/tools.js';
import { runAgent } from '../src/loop.js';

function setup() {
  const db = openDb(':memory:');
  upsertPage(db, { page_id: '/tr/rleon', url: '/tr/rleon', title: 'RLeon', text: 'cihaz üstü yapay zeka', lang: 'tr' });
  return { db, tools: makeTools(db) };
}
const config = { maxTurns: 8 };

test('loop: tool call then final answer', async () => {
  const { db, tools } = setup();
  let turn = 0;
  const callModelImpl = async ({ onDelta }) => {
    turn++;
    if (turn === 1) return { content: '', toolCalls: [{ id: 'c1', name: 'search', args: { query: 'yapay zeka' } }], usage: null };
    onDelta?.('RLeon cihazda çalışır.');
    return { content: 'RLeon cihazda çalışır.', toolCalls: [], usage: null };
  };
  const out = await runAgent({ db, tools, sessionId: 'S', siteKey: 'k', siteName: 'site', userMessage: 'ne yapıyor', config, onDelta: () => {}, callModelImpl });
  assert.equal(out.reason, 'completed');
  assert.match(out.content, /RLeon/);
});

test('loop: max_turns guard', async () => {
  const { db, tools } = setup();
  const callModelImpl = async () => ({ content: '', toolCalls: [{ id: 'x', name: 'list_pages', args: {} }], usage: null });
  const out = await runAgent({ db, tools, sessionId: 'S2', siteKey: 'k', siteName: 'site', userMessage: 'x', config: { maxTurns: 3 }, onDelta: () => {}, callModelImpl });
  assert.equal(out.reason, 'max_turns');
});
