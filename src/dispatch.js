export function dispatchOne(tools, { name, args }) {
  const tool = tools[name];
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  try {
    const v = tool.validate(args || {});
    if (!v.ok) return { ok: false, error: v.error };
    return { ok: true, result: tool.run(args || {}) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

export async function dispatchAll(tools, calls) {
  return Promise.all(calls.map((c) => Promise.resolve(dispatchOne(tools, c))));
}
