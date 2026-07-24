import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rateLimiter } from './ratelimit.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function originAllowed(origin, allowed) {
  if (!origin) return false;
  let h; try { h = new URL(origin).hostname; } catch { return false; }
  return allowed.some((o) => h === o || h.endsWith('.' + o));
}

async function readJson(req) {
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
}

export function createServer(config, deps) {
  const rl = rateLimiter(config.rateLimitPerMin);
  const widgetPath = join(__dir, '..', 'public', 'widget.js');

  return http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); return res.end('ok'); }
    if (req.method === 'GET' && req.url === '/widget.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript', 'Access-Control-Allow-Origin': '*' });
      return res.end(readFileSync(widgetPath, 'utf8'));
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': req.headers.origin || '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, GET' });
      return res.end();
    }
    if (req.method === 'POST' && req.url === '/chat') {
      const origin = req.headers.origin;
      if (!originAllowed(origin, config.allowedOrigins)) { res.writeHead(403); return res.end('forbidden origin'); }
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
      if (!rl.allow(ip)) { res.writeHead(429); return res.end('rate limited'); }
      const body = await readJson(req);
      if (!body || !body.session_id || !body.message) { res.writeHead(400); return res.end('bad request'); }
      if (body.website) { res.writeHead(400); return res.end('spam'); } // honeypot
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': origin });
      const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const onDelta = (t) => send('delta', { text: t });
      try {
        const out = await deps.runAgentImpl({
          db: deps.db, tools: deps.tools, sessionId: body.session_id, siteKey: origin,
          siteName: deps.siteName, userMessage: body.message, config, onDelta,
        });
        if (out.reason === 'error') send('error', { message: out.content });
        else send('done', { reason: out.reason });
      } catch (e) {
        send('error', { message: String(e.message || e) });
      }
      return res.end();
    }
    res.writeHead(404); res.end('not found');
  });
}
