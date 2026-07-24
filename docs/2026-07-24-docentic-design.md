# docentic — Tasarım Belgesi

**Tarih:** 2026-07-24
**Durum:** taslak, onay bekliyor

## Ne

Statik siteye gömülen, açık kaynak, kendi sunucunda host edilen **agentic site-asistanı**. Web3Forms modeli: isteyen kendi sunucusuna kurar, sitesine tek `<script>` ile gömer. Ziyaretçi soru sorar; asistan, sitenin **kendi içeriğinde** araçlarla gezerek (arşiv, yazılar, sayfalar) cevaplar.

Ad: **docentic** — `docent` (ziyaretçiye içeriği anlatan rehber) + `agentic`.

## Neden

- Statik siteler (GitHub Pages vb.) canlı bir asistan barındıramaz — backend yok.
- Mevcut çözümler ya jenerik chatbot (site içeriğini bilmez) ya da ağır SaaS.
- Kendi sunucusunda, kendi API anahtarıyla, kendi verisinde gezen, sade bir agentic asistan yok.

## Temel ilkeler

1. **İki parça, ayrık.** Widget (istemci) ve sunucu bağımsız. Sunucu ölse site ayakta; widget ölse sayfa okunur.
2. **Siteye özel kod yok.** Herhangi bir statik site `sitemap.xml` verirse çalışır.
3. **İki bellek asla karışmaz.** Site verisi = paylaşımlı, salt-okunur. Konuşma = session-izole, kişiye özel.
4. **Fail-closed güvenlik.** Bilinmeyen durum = reddet. Araçlar read-only SQL'e hapsedilir.
5. **Küçük çekirdek.** Referanslardan (Claude Code, hermes, openclaw) desen alınır, hacim alınmaz.

---

## Mimari

```
[ziyaretçi]
   │  soru
   ▼
[widget: HTML/CSS/JS]  ──POST /chat (SSE)──►  [docentic sunucu]
                                                  │
                                    ┌─────────────┼──────────────┐
                                    ▼             ▼              ▼
                              agentic loop   SQLite         provider
                              (maxTurns)   (pages+FTS5,     (Gemini/
                                    │        sessions,       Claude/
                                    │        messages)       OpenAI)
                                    ▼
                              araçlar: list_pages / read_page / search
                                    │  (read-only SQL)
                                    ▼
                              [site verisi]  ◄──sitemap.xml + fetch──  [müşterinin sitesi]
```

### Bileşenler

**1. Widget** (`widget.js`, tek dosya, framework yok)
- `<script src=".../widget.js" data-endpoint="..." data-key="...">` ile gömülür.
- Bir `session_id` üretir (rastgele token, `localStorage`'da saklar).
- Soru → `POST /chat {key, session_id, message}` → SSE cevabı canlı yazar.
- Honeypot alanı (gizli input) — bot doldurursa istek düşer.

**2. Sunucu** (Node, tek servis)
- `POST /chat` — SSE stream. Agentic loop'u çalıştırır.
- `GET /widget.js` — widget dosyasını servis eder.
- Config: provider + API anahtarı, izinli domainler, model, limitler, saklama süresi.

**3. Depolama** (tek SQLite dosyası)
```sql
pages(page_id PK, url, title, text, lang, etag, fetched_at)   -- + FTS5 sanal tablo
sessions(id PK, site_key, created_at, message_count, input_tokens, output_tokens,
         parent_session_id)   -- parent_session_id şimdilik kullanılmaz, kolon durur
messages(id AUTOINCREMENT, session_id FK, role, content, tool_calls,
         tool_call_id, tool_name, created_at)
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```
- `session_id` = izolasyon sınırı. Bir session diğerini görmez.
- Artımlı flush: her turda sadece yeni mesajlar yazılır (stream ortasında çökse bile kalıcı).

---

## Site verisi — keşif ve tazeleme

1. İlk istekte sunucu, izinli domain'in `sitemap.xml`'ini çeker → sayfa listesi.
2. `sitemap` yoksa kök sayfayı çekip linkleri tarar (fallback, sadece izinli domain içi).
3. Her sayfa lazy fetch edilir, HTML'den temiz metin çıkarılır, `pages` tablosuna + FTS5'e yazılır.
4. Tazeleme: `ETag`/`Last-Modified` kontrolü + TTL (varsayılan 1 saat). Değişen sayfa güncellenir.
5. Site verisi **paylaşımlı**: bir kez ısınır, tüm ziyaretçiler aynı cache'ten okur. Her giren için tekrar çekmez.

**gitdex dersi:** her içerik birimi (sayfa) stabil kimlikle (`page_id`/URL) adreslenebilir temiz-metne indirilir. Arama tarafını FTS5 tamamlar.

---

## Agentic loop

Referans: Claude Code `queryLoop`, hermes `run_conversation`. Tek async generator:

```
loop(session_id, user_message):
    messages = [system_prompt] + gecmis(session_id) + [user_message]
    turn = 0
    while turn < MAX_TURNS:
        turn += 1
        response = provider.stream(messages, TOOLS)     # SSE delta'ları client'a akar
        if response.tool_calls:
            messages.append(assistant(response))
            results = paralel([dispatch(t) for t in response.tool_calls])  # hepsi read-only
            messages += tool_results(results)
            flush(session_id, yeni mesajlar)
            continue
        else:
            flush(session_id, final)
            return response.content        # reason: completed
    return "..."                           # reason: max_turns
```

- **Bitiş:** model tool çağırmıyor (`completed`) · `MAX_TURNS` aşıldı (`max_turns`) · hata (`error`).
- **MAX_TURNS** (varsayılan 8) — sonsuz döngü / token yakma koruması.
- **Read-only araçlar paralel** çalışır (`Promise.all`).
- **Streaming:** metin delta'ları SSE ile anında client'a; ayrıca "arıyorum… / şu sayfayı okuyorum…" tool-progress event'i.
- Streaming-tool-execution (model bitmeden tool başlatma) — v1'de **atla**.

### Araçlar

Her araç: `{ name, description, inputSchema (zod), isReadOnly: true, validateInput, handler }`. Zod → JSON Schema → provider'a tool tanımı. Handler **asla exception atmaz** → `{"error": "..."}` döner (model toparlar).

| Araç | Girdi | İş |
|---|---|---|
| `list_pages` | — | pages'ten başlık + URL listesi |
| `read_page` | `{page_id}` | sayfanın temiz metnini döndürür. `validateInput`: page_id DB'de var mı |
| `search` | `{query, limit?}` | FTS5 (BM25) tam-metin arama, tr+en |

Dispatch = düz `Map<name, tool>`. Tek merkezi `authorize + validate + call` boğaz noktası.

### Sistem promptu (parça-dizisi + join)

- Kimlik: "Bu sitenin asistanısın. Sadece araçlarla eriştiğin site içeriğine dayan."
- Site bağlamı: site adı, dil(ler).
- Araç kuralları: "Önce ara/oku, sonra cevapla."
- Sınır: **"Bulamazsan 'bu konuda sitede bilgi yok' de. Uydurma. Site dışı konulara girme."**
- Site içeriği modele **veri** olarak işaretlenir (talimat değil) — prompt injection savunması.

---

## Session ve memory

- Her ziyaretçi = ayrı `session_id` (widget üretir, `localStorage`).
- Konuşma geçmişi session'a bağlı. Modele giden context her turda tam olarak: `[site verisi (araçlarla)] + [sadece bu session'ın mesajları] + [yeni soru]`.
- Bir ziyaretçinin mesajı **asla** başka session'ın context'ine girmez, **asla** site verisi olmaz.
- Konuşmalar SQLite'ta saklanır — **owner (site sahibi) görür**, ziyaretçiler birbirininkini göremez.
- **v1: session-bazlı.** Uzun-dönem ziyaretçi hafızası (sonraki ziyarette hatırlama) yok. Şemada `parent_session_id` kolonu ileride context-compaction için durur ama kullanılmaz.
- `session_id` = tahmin-edilemez rastgele token. Bir session'ın diğerine sızmaması **veri modeli** (FK izolasyonu) ile garanti; imzalı/kimlikli token gibi ek koruma **v1'de gerekmez** (ziyaretçi kendi cihazındaki kendi konuşmasını taşır, hassas veri yok).
- Context penceresi: v1'de `maxMessages` penceresi (son N mesaj). Compaction/özetleme ertelenir (Claude Code'un eşik-tetiklemeli yapılandırılmış özeti ölçeklenince eklenir).

---

## Provider — OpenRouter (tek)

Tek sağlayıcı: **OpenRouter** (OpenAI-uyumlu Chat Completions API, `https://openrouter.ai/api/v1`).
- Tek anahtar, tek client. Model `env` ile seçilir (`MODEL=anthropic/claude-sonnet-4.6`, `google/gemini-...` vb.) → tek satırla model değişir.
- Çok-provider soyutlaması **gereksiz** — OpenRouter zaten tüm modelleri tek API'de topluyor. hermes'in 5 api_mode + transport registry'si atlanır.
- Yine de iç `NormalizedResponse { content, tool_calls, finish_reason, usage }` tipi tutulur — loop ham API yanıtına değil bu tipe bakar; ileride başka provider gerekirse tek `parse_response` değişir.
- Tool calling: OpenRouter modele bağlı function-calling destekler; zod → JSON Schema tanımı gönderilir.
- API anahtarı sunucuda `env`. Siteye **asla** geçmez.

---

## Güvenlik

| Tehdit | Önlem |
|---|---|
| SSRF | `read_page`/fetch **sadece config'deki izinli domain(ler)i** çeker. Keyfi URL yok. |
| Domain hırsızlığı | `Origin` header + config allowlist. İzinsiz origin → 403. |
| Kota patlatma | IP + session başına rate limit (token bucket). İstek başına MAX_TURNS + max token bütçesi. Günlük site bütçesi. |
| Sonsuz döngü | MAX_TURNS sabit sınır. |
| Prompt injection | Site içeriği + ziyaretçi mesajı "untrusted data". Sessionlar izole. Sıkı system prompt. |
| SQL injection | Araçlar **read-only, parametreli** sorgular. `SELECT` dışına izin yok. String-concat yok. |
| Secret sızması | API anahtarı sunucuda env. `data-key` sadece public tanımlayıcı. |
| Spam | Honeypot + rate limit. |
| Gizlilik (KVKK/GDPR) | Ziyaretçiye bilgi notu, IP anonimleştirme opsiyonu, saklama süresi ayarı. |

**Merkezi tek yetki noktası:** her tool çağrısı ortak `authorize(tool, input)`'tan geçer, izin araç koduna gömülmez. Fail-closed default.

---

## Teknoloji ve kurulum

- **Runtime:** Node (widget JS'iyle aynı dil, SSE kolay).
- **Depo:** tek SQLite (WAL). Ölçek gerekirse Postgres.
- **Kurulum:** Docker tek komut.
  ```
  docker run -e OPENROUTER_API_KEY=xxx \
             -e MODEL=anthropic/claude-sonnet-4.6 \
             -e ALLOWED_ORIGINS=efekurucay.com \
             -e RATE_LIMIT=20/min \
             -p 8080:8080 ghcr.io/efekurucay/docentic
  ```
- **Gömme:**
  ```html
  <script src="https://sunucun/widget.js"
          data-endpoint="https://sunucun" data-key="site-public-key"></script>
  ```
- **Lisans:** MIT.

---

## v1 kapsamı (MVP) — ne var, ne yok

**Var:** widget + sunucu + SQLite(pages/FTS5/sessions/messages) + 3 araç + agentic loop (maxTurns) + 3 provider + sitemap keşfi + ETag/TTL tazeleme + domain allowlist + SSRF kilidi + rate limit + honeypot + SSE streaming + session izolasyonu + owner konuşma logu.

**Yok (ertelendi):** context compaction/özetleme (maxMessages penceresi yeter), uzun-dönem ziyaretçi hafızası, streaming-tool-execution, embedding/semantik arama (FTS5 yeter), multi-provider fallback dansı, owner dashboard (log DB'de durur, arayüz sonra).

---

## Referanslardan alınan dersler (özet)

- **Claude Code:** tek async generator loop; maxTurns + reason enum; tool = zod şema + describe + call + isReadOnly; validateInput ayrı aşama; merkezi fail-closed yetki; compaction eşik-tetiklemeli (ertelendi); read-only araçları paralelle.
- **hermes:** loop çekirdeği (tool_call varsa çalıştır+devam, yoksa bitir); tool registry + tek dispatch + zorunlu JSON-error; SQLite iki-tablo (sessions+messages FK) izolasyon; artımlı flush + lazy session; normalized response, provider-agnostik loop.
- **gitdex:** içerik birimini stabil kimlikli temiz-metne indir (bizim HTML→pages satırı). Aramayı FTS5 tamamlar.
- **Hepsinden atlanan:** OS sandbox, permission modları, multi-provider registry, coordinator/swarm, MCP, hooks, üç-katman compaction — genel-amaçlı araçların cilası; tek-amaçlı site-asistanına gürültü.
