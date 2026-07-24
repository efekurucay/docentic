import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { listPages, getPage, searchPages } from './pages.js';

const mk = (name, description, schema, validate, run) => ({
  name, description, schema,
  jsonSchema: zodToJsonSchema(schema, { target: 'openApi3' }),
  validate: (input) => {
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.message };
    return validate ? validate(p.data) : { ok: true };
  },
  run: (input) => run(schema.parse(input)),
});

export function makeTools(db) {
  return {
    list_pages: mk('list_pages', 'Sitedeki tüm sayfaların başlık ve URL listesi.',
      z.object({}), null, () => listPages(db)),
    read_page: mk('read_page', 'Bir sayfanın tam metnini döndürür. page_id list_pages/search çıktısından gelir.',
      z.object({ page_id: z.string() }),
      ({ page_id }) => getPage(db, page_id) ? { ok: true } : { ok: false, error: 'page not found' },
      ({ page_id }) => { const p = getPage(db, page_id); return p ? { page_id, title: p.title, text: p.text } : { error: 'page not found' }; }),
    search: mk('search', 'Site içeriğinde anahtar kelime araması (tr+en). İlgili sayfaları bulmak için önce bunu kullan.',
      z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(10).optional() }),
      null,
      ({ query, limit }) => searchPages(db, query, limit ?? 5)),
  };
}
