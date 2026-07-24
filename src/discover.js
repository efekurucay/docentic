import { parse } from 'node-html-parser';
import { upsertPage, getPage } from './pages.js';

export function isAllowed(url, allowedOrigins) {
  let h;
  try { h = new URL(url).hostname; } catch { return false; }
  return allowedOrigins.some((o) => h === o || h.endsWith('.' + o));
}

export function htmlToText(html) {
  const root = parse(html);
  const title = root.querySelector('title')?.text?.trim() || '';
  for (const sel of ['script', 'style', 'nav', 'noscript']) root.querySelectorAll(sel).forEach((n) => n.remove());
  const body = root.querySelector('body') || root;
  const text = body.text.replace(/\s+/g, ' ').trim();
  return { title, text };
}

export function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

const pageId = (url) => new URL(url).pathname.replace(/\/$/, '') || '/';

export async function refreshSite(db, { baseUrl, allowedOrigins, ttlMin, fetchImpl = fetch }) {
  const smUrl = new URL('/sitemap.xml', baseUrl).href;
  if (!isAllowed(smUrl, allowedOrigins)) return;
  let urls = [];
  try {
    const r = await fetchImpl(smUrl);
    if (r.ok) urls = parseSitemap(await r.text());
  } catch { /* sitemap yok */ }
  if (urls.length === 0) urls = [baseUrl]; // fallback: kök
  const ttlMs = ttlMin * 60 * 1000;
  for (const u of urls) {
    if (!isAllowed(u, allowedOrigins)) continue;
    const id = pageId(u);
    const existing = getPage(db, id);
    if (existing && Date.now() - existing.fetched_at < ttlMs) continue;
    try {
      const r = await fetchImpl(u);
      if (!r.ok) continue;
      const { title, text } = htmlToText(await r.text());
      const lang = /\/en\//.test(u) ? 'en' : 'tr';
      upsertPage(db, { page_id: id, url: u, title, text, lang });
    } catch { /* atla */ }
  }
}
