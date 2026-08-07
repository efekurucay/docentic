// Contact submissions: the assistant's submit_contact tool and the /contact
// form both land here. This is docentic's only write path — kept narrow.

export function addContact(db, { siteKey, sessionId, name, email, message, source }) {
  const info = db.prepare(
    `INSERT INTO contacts(site_key,session_id,name,email,message,source,created_at)
     VALUES(?,?,?,?,?,?,?)`
  ).run(siteKey || null, sessionId || null, (name || '').slice(0, 200),
        (email || '').slice(0, 200), (message || '').slice(0, 4000),
        source || 'form', Date.now());
  return info.lastInsertRowid;
}

export function listContacts(db, siteKey, limit = 100) {
  return db.prepare(
    `SELECT * FROM contacts WHERE (@site IS NULL OR site_key=@site)
     ORDER BY id DESC LIMIT @lim`).all({ site: siteKey || null, lim: limit });
}

// Fire-and-forget notification to an optional webhook (Telegram/Discord/ntfy/…).
// Pass chatId to send via a Telegram bot API URL (needs chat_id, not the
// generic {text,content,message} shape the others accept).
export async function notifyWebhook(url, contact, fetchImpl = fetch, chatId = '') {
  if (!url) return false;
  const text = `New contact${contact.name ? ' from ' + contact.name : ''}` +
    `${contact.email ? ' <' + contact.email + '>' : ''}:\n${contact.message}` +
    `${contact.source ? '\n(via ' + contact.source + ')' : ''}`;
  const body = chatId ? { chat_id: chatId, text } : { text, content: text, message: text, ...contact };
  try {
    await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return true;
  } catch { return false; }
}
