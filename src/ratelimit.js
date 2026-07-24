export function rateLimiter(perMin) {
  const buckets = new Map();
  let sinceSweep = 0;
  return {
    allow(key) {
      const now = Date.now();
      // Periodically evict idle buckets so the map cannot grow unbounded.
      if (++sinceSweep >= 1000) {
        sinceSweep = 0;
        for (const [k, v] of buckets) if (now - v.ts > 300000) buckets.delete(k);
      }
      const b = buckets.get(key) || { tokens: perMin, ts: now };
      const refill = ((now - b.ts) / 60000) * perMin;
      b.tokens = Math.min(perMin, b.tokens + refill);
      b.ts = now;
      if (b.tokens < 1) { buckets.set(key, b); return false; }
      b.tokens -= 1; buckets.set(key, b); return true;
    },
  };
}
