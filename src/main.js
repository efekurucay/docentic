import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { makeTools } from './tools.js';
import { refreshSite } from './discover.js';
import { runAgent } from './loop.js';
import { createServer } from './server.js';
import { addContact, notifyWebhook } from './contacts.js';

const config = loadConfig();
const db = openDb(process.env.DB_PATH || 'docentic.db');
const tools = makeTools(db);
const siteName = config.allowedOrigins.find((o) => o !== 'localhost') || config.allowedOrigins[0] || 'this site';
const baseUrl = `https://${siteName}`;

async function refresh() {
  try {
    await refreshSite(db, { baseUrl, allowedOrigins: config.allowedOrigins, ttlMin: config.siteCacheTtlMin });
    console.log(`[docentic] site refreshed: ${baseUrl} (${db.prepare('SELECT COUNT(*) c FROM pages').get().c} pages)`);
  } catch (e) {
    console.error('[docentic] refresh error', e.message);
  }
}

const server = createServer(config, {
  db, tools, siteName,
  runAgentImpl: (args) => runAgent({ ...args, config }),
  onContact: (c) => {
    addContact(db, c);
    if (config.contactWebhook) notifyWebhook(config.contactWebhook, c, fetch, config.contactChatId);
  },
});
server.listen(config.port, () => console.log(`[docentic] listening on :${config.port}`));

// Warm the site cache in the background; the server does not wait for it.
refresh();
setInterval(refresh, config.siteCacheTtlMin * 60 * 1000);
