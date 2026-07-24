# docentic

An embeddable, self-hosted **agentic assistant for static sites**. A visitor
asks a question; docentic walks your site's own content with tools (search,
read pages) and answers — streamed, in the visitor's language.

Think Web3Forms, but instead of a form endpoint you get a small AI agent that
knows your site. You run it on your own server, with your own model key, and
drop one `<script>` tag into any static site.

- **No framework, no build** for the client — one `widget.js`.
- **One SQLite file** holds the crawled site content (FTS5), sessions, and messages.
- **Agentic loop** over a read-only toolset; the model decides what to read.
- **Provider:** OpenRouter (any model via one key), with a fallback model.
- **Isolated sessions** — one visitor never sees another's conversation.

## How it works

```
visitor → widget.js → POST /chat (SSE) → docentic server → OpenRouter
                                              │ tools walk site content
                                              ▼
                                        SQLite (pages + FTS5, sessions, messages)
                                              ▲ sitemap.xml + fetch
                                        your static site
```

The server discovers your pages from `sitemap.xml` (falling back to a one-level
link crawl), stores clean page text in SQLite with full-text search, and gives
the model three read-only tools: `list_pages`, `read_page`, `search`. The loop
runs until the model stops calling tools (bounded by `MAX_TURNS`).

## Run it

```bash
docker run -p 8080:8080 \
  -e OPENROUTER_API_KEY=sk-or-... \
  -e MODEL=openrouter/free \
  -e FALLBACK_MODEL=deepseek/deepseek-v4-flash \
  -e ALLOWED_ORIGINS=yoursite.com \
  ghcr.io/efekurucay/docentic
```

Or without Docker (Node ≥ 22):

```bash
npm install
cp .env.example .env   # fill in OPENROUTER_API_KEY and ALLOWED_ORIGINS
node --env-file=.env src/main.js
```

## Embed it

Add one tag to your static site, pointing at your server:

```html
<script src="https://your-docentic-host/widget.js"
        data-endpoint="https://your-docentic-host"
        data-key="your-site"
        data-title="Ask this site"></script>
```

The widget renders a small chat box, keeps a per-visitor session in
`localStorage`, and streams answers over SSE.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `OPENROUTER_API_KEY` | — (required) | Your OpenRouter key. Never sent to the browser. |
| `MODEL` | `openrouter/free` | Primary model. `openrouter/free` routes over free models. |
| `FALLBACK_MODEL` | `deepseek/deepseek-v4-flash` | Used if the primary call fails. |
| `ALLOWED_ORIGINS` | — | Comma-separated hostnames allowed to embed and to be crawled. |
| `PORT` | `8080` | HTTP port. |
| `RATE_LIMIT_PER_MIN` | `20` | Requests per minute per IP. |
| `MAX_TURNS` | `8` | Max agent loop iterations per question. |
| `SITE_CACHE_TTL_MIN` | `60` | Minutes before a page is re-fetched. |

## Security

- **SSRF-safe:** the server only fetches hosts in `ALLOWED_ORIGINS`. Sitemap
  entries are remapped onto the allowed host, so a sitemap can list any domain.
- **Read-only tools:** parameterized SQL only; no writes, no string-concat.
- **Origin allowlist + honeypot + rate limit** on `/chat`.
- **Prompt-injection aware:** page text and tool results are treated as data,
  not instructions; sessions are isolated by foreign key.
- The API key lives only in `env`; the browser gets a public `data-key` at most.

## Development

```bash
npm test        # node:test, no network (fetch is injected/mocked)
```

## License

MIT
