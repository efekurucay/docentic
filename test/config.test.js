import { test } from 'node:test';
import assert from 'node:assert';
import { loadConfig } from '../src/config.js';

test('loadConfig parses env', () => {
  const c = loadConfig({ OPENROUTER_API_KEY: 'k', ALLOWED_ORIGINS: 'a.com, b.com' });
  assert.equal(c.openrouterApiKey, 'k');
  assert.deepEqual(c.allowedOrigins, ['a.com', 'b.com']);
  assert.equal(c.model, 'openrouter/free');
  assert.equal(c.fallbackModel, 'deepseek/deepseek-v4-flash');
  assert.equal(c.maxTurns, 8);
});

test('loadConfig throws without key', () => {
  assert.throws(() => loadConfig({}), /OPENROUTER_API_KEY/);
});
