import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { addContact, listContacts, notifyWebhook } from '../src/contacts.js';

test('addContact + listContacts isolated by site', () => {
  const db = openDb(':memory:');
  addContact(db, { siteKey: 'a.com', name: 'Ada', email: 'a@x.com', message: 'hi', source: 'form' });
  addContact(db, { siteKey: 'b.com', name: 'Bob', message: 'yo', source: 'tool' });
  assert.equal(listContacts(db, 'a.com').length, 1);
  assert.equal(listContacts(db, 'a.com')[0].name, 'Ada');
  assert.equal(listContacts(db, null).length, 2);
});

test('addContact truncates oversized message', () => {
  const db = openDb(':memory:');
  addContact(db, { siteKey: 's', message: 'x'.repeat(9000) });
  assert.equal(listContacts(db, 's')[0].message.length, 4000);
});

test('notifyWebhook posts and returns true; skips when no url', async () => {
  let called = null;
  const fetchImpl = async (url, opts) => { called = { url, body: JSON.parse(opts.body) }; return { ok: true }; };
  assert.equal(await notifyWebhook('', {}, fetchImpl), false);
  assert.equal(await notifyWebhook('http://hook', { name: 'Ada', message: 'hi', source: 'tool' }, fetchImpl), true);
  assert.match(called.body.text, /Ada/);
  assert.match(called.body.text, /via tool/);
});

test('notifyWebhook sends Telegram-shaped body when chatId is set', async () => {
  let called = null;
  const fetchImpl = async (url, opts) => { called = { url, body: JSON.parse(opts.body) }; return { ok: true }; };
  await notifyWebhook('https://api.telegram.org/botX/sendMessage', { name: 'Ada', message: 'hi' }, fetchImpl, '12345');
  assert.equal(called.body.chat_id, '12345');
  assert.match(called.body.text, /Ada/);
  assert.equal(called.body.content, undefined);
});
