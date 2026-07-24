import { test } from 'node:test';
import assert from 'node:assert';
import { systemPrompt } from '../src/prompt.js';

test('systemPrompt includes guardrails', () => {
  const p = systemPrompt({ siteName: 'efekurucay.com' });
  assert.match(p, /efekurucay\.com/);
  assert.match(p, /never make things up|NEVER make things up/i);
  assert.match(p, /search/i);
  assert.match(p, /visitor/i);
});
