import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { listPages, getPage, searchPages } from './pages.js';
import { addContact, notifyWebhook } from './contacts.js';

const mk = (name, description, schema, validate, run, readOnly = true) => ({
  name, description, schema, readOnly,
  jsonSchema: zodToJsonSchema(schema, { target: 'openApi3' }),
  validate: (input) => {
    const p = schema.safeParse(input);
    if (!p.success) return { ok: false, error: p.error.message };
    return validate ? validate(p.data) : { ok: true };
  },
  run: (input, ctx) => run(schema.parse(input), ctx || {}),
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
    submit_contact: mk('submit_contact',
      'Ziyaretçi site sahibine bir mesaj/iletişim bırakmak istediğinde çağır. Mesajı iletir. Sadece ziyaretçi açıkça istediğinde ve en azından bir mesaj metni topladığında kullan.',
      z.object({ message: z.string().min(1), name: z.string().optional(), email: z.string().optional() }),
      null,
      ({ message, name, email }, ctx) => {
        addContact(db, { siteKey: ctx.siteKey, sessionId: ctx.sessionId, name, email, message, source: 'assistant' });
        if (ctx.webhook) notifyWebhook(ctx.webhook, { name, email, message, source: 'assistant' }, fetch, ctx.chatId);
        return { ok: true, delivered: true, note: 'Mesaj site sahibine iletildi.' };
      },
      /* readOnly */ false),
  };
}
