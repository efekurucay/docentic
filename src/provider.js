const URL_OR = 'https://openrouter.ai/api/v1/chat/completions';

export function parseToolCalls(message) {
  return (message.tool_calls || []).map((c) => ({
    id: c.id,
    name: c.function?.name,
    args: safeJson(c.function?.arguments),
  }));
}
const safeJson = (s) => { try { return JSON.parse(s || '{}'); } catch { return {}; } };

export function buildRequest({ model, messages, tools }) {
  return {
    model, messages, stream: true,
    tools: (tools || []).map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.jsonSchema } })),
  };
}

async function once({ apiKey, model, messages, tools, onDelta, fetchImpl }) {
  const res = await fetchImpl(URL_OR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(buildRequest({ model, messages, tools })),
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  let content = '';
  const toolMap = new Map();
  let usage = null;
  for await (const evt of sseLines(res.body)) {
    if (evt === '[DONE]') break;
    let j; try { j = JSON.parse(evt); } catch { continue; }
    if (j.usage) usage = j.usage;
    const d = j.choices?.[0]?.delta;
    if (!d) continue;
    if (d.content) { content += d.content; onDelta?.(d.content); }
    for (const tc of d.tool_calls || []) {
      const cur = toolMap.get(tc.index) || { id: tc.id, function: { name: '', arguments: '' } };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.function.name += tc.function.name;
      if (tc.function?.arguments) cur.function.arguments += tc.function.arguments;
      toolMap.set(tc.index, cur);
    }
  }
  const toolCalls = parseToolCalls({ tool_calls: [...toolMap.values()] });
  return { content, toolCalls, usage };
}

export async function callModel({ apiKey, model, fallbackModel, messages, tools, onDelta, fetchImpl = fetch }) {
  try {
    return await once({ apiKey, model, messages, tools, onDelta, fetchImpl });
  } catch (e) {
    if (!fallbackModel || fallbackModel === model) throw e;
    return await once({ apiKey, model: fallbackModel, messages, tools, onDelta, fetchImpl });
  }
}

async function* sseLines(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of block.split('\n')) {
        const m = line.match(/^data:\s?(.*)$/);
        if (m) yield m[1];
      }
    }
  }
}
