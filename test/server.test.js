import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../src/server.js';

function boot() {
  const config = { allowedOrigins: ['efekurucay.com'], rateLimitPerMin: 100, port: 0 };
  const contacts = [];
  const deps = {
    runAgentImpl: async ({ onDelta }) => { onDelta('selam'); return { reason: 'completed', content: 'selam' }; },
    onContact: (c) => contacts.push(c),
    db: {}, tools: {}, siteName: 'test',
  };
  const srv = createServer(config, deps);
  srv._contacts = contacts;
  return srv;
}

test('rejects foreign origin', async () => {
  const srv = boot(); await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const res = await fetch(`http://localhost:${port}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.com' },
    body: JSON.stringify({ session_id: 's', message: 'hi' }),
  });
  assert.equal(res.status, 403);
  await res.text();
  srv.close();
});

test('honeypot filled → 400', async () => {
  const srv = boot(); await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const res = await fetch(`http://localhost:${port}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://efekurucay.com' },
    body: JSON.stringify({ session_id: 's', message: 'hi', website: 'bot-filled' }),
  });
  assert.equal(res.status, 400);
  await res.text();
  srv.close();
});

test('contact form submits and is recorded', async () => {
  const srv = boot(); await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const res = await fetch(`http://localhost:${port}/contact`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://efekurucay.com' },
    body: JSON.stringify({ session_id: 's', name: 'Ada', message: 'merhaba' }),
  });
  assert.equal(res.status, 200);
  await res.text();
  assert.equal(srv._contacts.length, 1);
  assert.equal(srv._contacts[0].message, 'merhaba');
  assert.equal(srv._contacts[0].source, 'form');
  srv.close();
});

test('contact honeypot rejected', async () => {
  const srv = boot(); await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const res = await fetch(`http://localhost:${port}/contact`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://efekurucay.com' },
    body: JSON.stringify({ message: 'spam', website: 'bot' }),
  });
  assert.equal(res.status, 400);
  await res.text();
  srv.close();
});

test('valid → SSE stream', async () => {
  const srv = boot(); await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const res = await fetch(`http://localhost:${port}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://efekurucay.com' },
    body: JSON.stringify({ session_id: 's', message: 'hi' }),
  });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /selam/);
  srv.close();
});
