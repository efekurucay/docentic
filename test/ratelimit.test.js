import { test } from 'node:test';
import assert from 'node:assert';
import { rateLimiter } from '../src/ratelimit.js';

test('rate limiter blocks after N', () => {
  const rl = rateLimiter(2);
  assert.equal(rl.allow('ip'), true);
  assert.equal(rl.allow('ip'), true);
  assert.equal(rl.allow('ip'), false);
  assert.equal(rl.allow('other'), true);
});
