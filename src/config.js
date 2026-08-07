export function loadConfig(env = process.env) {
  if (!env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY required');
  const list = (s) => (s || '').split(',').map((x) => x.trim()).filter(Boolean);
  return {
    openrouterApiKey: env.OPENROUTER_API_KEY,
    model: env.MODEL || 'openrouter/free',
    fallbackModel: env.FALLBACK_MODEL || 'deepseek/deepseek-v4-flash',
    allowedOrigins: list(env.ALLOWED_ORIGINS),
    port: Number(env.PORT || 8080),
    rateLimitPerMin: Number(env.RATE_LIMIT_PER_MIN || 20),
    maxTurns: Number(env.MAX_TURNS || 8),
    siteCacheTtlMin: Number(env.SITE_CACHE_TTL_MIN || 60),
    contactWebhook: env.TELEGRAM_BOT_TOKEN
      ? `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`
      : (env.CONTACT_WEBHOOK || ''),
    contactChatId: env.TELEGRAM_CHAT_ID || '',
  };
}
