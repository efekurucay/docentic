import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../src/server.js';

function boot() {
  const config = { allowedOrigins: ['efekurucay.com'], rateLimitPerMin: 100, port: 0 };
  const deps = {
    runAgentImpl: async ({ onDelta }) => { onDelta('selam'); return { reason: 'completed', content: 'selam' }; },
    db: {}, tools: {}, siteName: 'test',
  };
  return createServer(config, deps);
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
