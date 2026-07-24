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

// Fallback when there is no sitemap: pull same-site links from the root page.
export function extractLinks(html, baseUrl, allowedOrigins) {
  const root = parse(html);
  const out = new Set();
  for (const a of root.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    if (!href) continue;
    let abs;
    try { abs = new URL(href, baseUrl).href; } catch { continue; }
    abs = abs.split('#')[0];
    if (isAllowed(abs, allowedOrigins) && /^https?:/.test(abs)) out.add(abs);
  }
  return [...out];
}

const pageId = (url) => new URL(url).pathname.replace(/\/$/, '') || '/';

export async function refreshSite(db, { baseUrl, allowedOrigins, ttlMin, fetchImpl = fetch, maxPages = 200 }) {
  const smUrl = new URL('/sitemap.xml', baseUrl).href;
  if (!isAllowed(smUrl, allowedOrigins)) return;
  let urls = [];
  try {
    const r = await fetchImpl(smUrl);
    if (r.ok) {
      // Remap sitemap loc paths onto our own baseUrl: even if the sitemap
      // lists another domain (e.g. the production host), we fetch only from
      // the allowed origin.
      urls = parseSitemap(await r.text()).map((loc) => {
        try { return new URL(new URL(loc).pathname, baseUrl).href; } catch { return null; }
      }).filter(Boolean);
    }
  } catch { /* no sitemap */ }
  if (urls.length === 0) {
    // Fallback: fetch the root and crawl its same-site links one level.
    urls = [baseUrl];
    try {
      const r = await fetchImpl(baseUrl);
      if (r.ok) urls = [...new Set([baseUrl, ...extractLinks(await r.text(), baseUrl, allowedOrigins)])];
    } catch { /* no root */ }
  }
  urls = urls.slice(0, maxPages);
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
    } catch { /* skip */ }
  }
}
