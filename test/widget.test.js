import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

test('widget has honeypot + session logic', () => {
  const w = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');
  assert.match(w, /name="website"/);
  assert.match(w, /localStorage/);
  assert.match(w, /event: /);
});
