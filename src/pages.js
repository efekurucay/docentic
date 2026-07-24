export function upsertPage(db, { page_id, url, title, text, lang, etag = null }) {
  db.prepare(`INSERT INTO pages(page_id,url,title,text,lang,etag,fetched_at)
    VALUES(@page_id,@url,@title,@text,@lang,@etag,@t)
    ON CONFLICT(page_id) DO UPDATE SET
      url=@url,title=@title,text=@text,lang=@lang,etag=@etag,fetched_at=@t`)
    .run({ page_id, url, title, text, lang, etag, t: Date.now() });
}

export function getPage(db, page_id) {
  return db.prepare('SELECT * FROM pages WHERE page_id=?').get(page_id);
}

export function listPages(db) {
  return db.prepare('SELECT page_id,url,title,lang FROM pages ORDER BY url').all();
}

export function searchPages(db, query, limit = 5) {
  return db.prepare(
    `SELECT p.page_id, p.url, p.title,
            snippet(pages_fts,2,'[',']','…',12) AS snippet
     FROM pages_fts JOIN pages p ON p.page_id = pages_fts.page_id
     WHERE pages_fts MATCH ? ORDER BY bm25(pages_fts) LIMIT ?`
  ).all(query, limit);
}
