export function ensureSession(db, sessionId, siteKey) {
  db.prepare(`INSERT INTO sessions(id,site_key,created_at) VALUES(?,?,?)
              ON CONFLICT(id) DO NOTHING`).run(sessionId, siteKey, Date.now());
}

export function appendMessage(db, sessionId, m) {
  db.prepare(`INSERT INTO messages(session_id,role,content,tool_calls,tool_call_id,tool_name,created_at)
              VALUES(?,?,?,?,?,?,?)`).run(
    sessionId, m.role, m.content ?? null,
    m.tool_calls ? JSON.stringify(m.tool_calls) : null,
    m.tool_call_id ?? null, m.tool_name ?? null, Date.now());
  db.prepare('UPDATE sessions SET message_count=message_count+1 WHERE id=?').run(sessionId);
}

export function getHistory(db, sessionId, maxMessages = 20) {
  const rows = db.prepare(
    `SELECT role,content,tool_calls,tool_call_id,tool_name FROM messages
     WHERE session_id=? ORDER BY id DESC LIMIT ?`).all(sessionId, maxMessages);
  return rows.reverse().map((r) => ({
    role: r.role, content: r.content,
    ...(r.tool_calls ? { tool_calls: JSON.parse(r.tool_calls) } : {}),
    ...(r.tool_call_id ? { tool_call_id: r.tool_call_id } : {}),
    ...(r.tool_name ? { name: r.tool_name } : {}),
  }));
}

export function addUsage(db, sessionId, { input = 0, output = 0 }) {
  db.prepare('UPDATE sessions SET input_tokens=input_tokens+?,output_tokens=output_tokens+? WHERE id=?')
    .run(input, output, sessionId);
}
