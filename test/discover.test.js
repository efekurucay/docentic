import { test } from 'node:test';
import assert from 'node:assert';
import { openDb } from '../src/db.js';
import { getPage, listPages } from '../src/pages.js';
import { isAllowed, htmlToText, parseSitemap, refreshSite } from '../src/discover.js';

test('isAllowed blocks foreign + allows listed', () => {
  const a = ['efekurucay.com', 'localhost'];
  assert.equal(isAllowed('https://efekurucay.com/tr/', a), true);
  assert.equal(isAllowed('http://localhost:8901/tr/', a), true);
  assert.equal(isAllowed('https://evil.com/x', a), false);
  assert.equal(isAllowed('http://169.254.169.254/', a), false);
});

test('htmlToText strips markup', () => {
  const { title, text } = htmlToText('<html><head><title>T</title></head><body><nav>x</nav><h1>Baş</h1><p>gövde metni</p><script>bad</script></body></html>');
  assert.equal(title, 'T');
  assert.ok(text.includes('gövde metni'));
  assert.ok(!text.includes('bad'));
});

test('parseSitemap extracts locs', () => {
  const xml = '<urlset><url><loc>https://s/a</loc></url><url><loc>https://s/b</loc></url></urlset>';
  assert.deepEqual(parseSitemap(xml), ['https://s/a', 'https://s/b']);
});

test('refreshSite fetches allowed pages via injected fetch', async () => {
  const db = openDb(':memory:');
  const pages = {
    'https://efekurucay.com/sitemap.xml': '<urlset><url><loc>https://efekurucay.com/tr/</loc></url></urlset>',
    'https://efekurucay.com/tr/': '<html><head><title>Ana</title></head><body><p>merhaba dünya</p></body></html>',
  };
  const fetchImpl = async (u) => ({ ok: true, status: 200, headers: new Map(), text: async () => pages[u] });
  await refreshSite(db, { baseUrl: 'https://efekurucay.com', allowedOrigins: ['efekurucay.com'], ttlMin: 60, fetchImpl });
  assert.equal(listPages(db).length, 1);
  assert.ok(getPage(db, listPages(db)[0].page_id).text.includes('merhaba'));
});
