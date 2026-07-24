import { callModel } from './provider.js';
import { dispatchAll } from './dispatch.js';
import { systemPrompt } from './prompt.js';
import { ensureSession, appendMessage, getHistory, addUsage } from './sessions.js';

export async function runAgent({ db, tools, sessionId, siteKey, siteName, userMessage, config, onDelta, callModelImpl = callModel }) {
  ensureSession(db, sessionId, siteKey);
  appendMessage(db, sessionId, { role: 'user', content: userMessage });
  const sys = { role: 'system', content: systemPrompt({ siteName }) };
  const toolList = Object.values(tools);

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    const messages = [sys, ...getHistory(db, sessionId, 20)];
    let res;
    try {
      res = await callModelImpl({
        apiKey: config.openrouterApiKey, model: config.model, fallbackModel: config.fallbackModel,
        messages, tools: toolList, onDelta,
      });
    } catch (e) {
      return { reason: 'error', content: String(e.message || e) };
    }
    if (res.usage) addUsage(db, sessionId, { input: res.usage.prompt_tokens || 0, output: res.usage.completion_tokens || 0 });

    if (res.toolCalls && res.toolCalls.length) {
      appendMessage(db, sessionId, { role: 'assistant', content: res.content || '', tool_calls: res.toolCalls.map((t) => ({ id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.args) } })) });
      const results = await dispatchAll(tools, res.toolCalls.map((t) => ({ name: t.name, args: t.args })));
      res.toolCalls.forEach((t, i) => {
        const r = results[i];
        appendMessage(db, sessionId, { role: 'tool', tool_call_id: t.id, tool_name: t.name, content: JSON.stringify(r.ok ? r.result : { error: r.error }) });
      });
      continue;
    }
    appendMessage(db, sessionId, { role: 'assistant', content: res.content });
    return { reason: 'completed', content: res.content };
  }
  return { reason: 'max_turns', content: 'Yanıt üretilemedi (tur sınırı).' };
}
