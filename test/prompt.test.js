import { test } from 'node:test';
import assert from 'node:assert';
import { systemPrompt } from '../src/prompt.js';

test('systemPrompt includes guardrails', () => {
  const p = systemPrompt({ siteName: 'efekurucay.com', langs: ['tr', 'en'] });
  assert.match(p, /efekurucay\.com/);
  assert.match(p, /uydurma|Uydurma|do not/i);
  assert.match(p, /search|ara/i);
});
