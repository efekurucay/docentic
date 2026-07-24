import { test } from 'node:test';
import assert from 'node:assert';
import { parseToolCalls, buildRequest, callModel } from '../src/provider.js';

test('parseToolCalls parses openai format', () => {
  const msg = { tool_calls: [{ id: 'c1', function: { name: 'search', arguments: '{"query":"x"}' } }] };
  const r = parseToolCalls(msg);
  assert.equal(r[0].name, 'search');
  assert.deepEqual(r[0].args, { query: 'x' });
});

test('buildRequest wraps tools', () => {
  const b = buildRequest({ model: 'm', messages: [], tools: [{ name: 'search', description: 'd', jsonSchema: { type: 'object' } }] });
  assert.equal(b.tools[0].type, 'function');
  assert.equal(b.tools[0].function.name, 'search');
  assert.equal(b.stream, true);
});

function streamFrom(str) {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { c.enqueue(enc.encode(str)); c.close(); } });
}

test('callModel falls back on primary error', async () => {
  let calls = 0;
  const fetchImpl = async (url, opts) => {
    calls++;
    const model = JSON.parse(opts.body).model;
    if (model === 'primary') return { ok: false, status: 429, text: async () => 'rate' };
    const sse = 'data: {"choices":[{"delta":{"content":"merhaba"}}]}\n\ndata: [DONE]\n\n';
    return { ok: true, status: 200, body: streamFrom(sse) };
  };
  const out = await callModel({ apiKey: 'k', model: 'primary', fallbackModel: 'fb', messages: [], tools: [], onDelta: () => {}, fetchImpl });
  assert.equal(calls, 2);
  assert.equal(out.content, 'merhaba');
});
