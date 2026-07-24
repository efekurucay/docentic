import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { ensureSession, appendMessage, getHistory } from '../src/sessions.js';

test('sessions are isolated', () => {
  const db = openDb(':memory:');
  ensureSession(db, 'A', 'site'); ensureSession(db, 'B', 'site');
  appendMessage(db, 'A', { role: 'user', content: 'gizli-A' });
  appendMessage(db, 'B', { role: 'user', content: 'gizli-B' });
  const a = getHistory(db, 'A');
  assert.equal(a.length, 1);
  assert.equal(a[0].content, 'gizli-A');
  assert.ok(!JSON.stringify(a).includes('gizli-B'));
});

test('getHistory window limits', () => {
  const db = openDb(':memory:');
  ensureSession(db, 'A', 'site');
  for (let i = 0; i < 30; i++) appendMessage(db, 'A', { role: 'user', content: 'm' + i });
  assert.equal(getHistory(db, 'A', 10).length, 10);
});
