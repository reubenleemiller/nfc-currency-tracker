const requests = new Map<string, number[]>();
export function rateLimited(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const recent = (requests.get(key) ?? []).filter((time) => now - time < windowMs);
  recent.push(now); requests.set(key, recent);
  return recent.length > limit;
}
