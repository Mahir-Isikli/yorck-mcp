export function decodeJwt<T = Record<string, unknown>>(token: string): T {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("invalid jwt");
  const payload = parts[1];
  // base64url -> base64
  const b64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
  const json = atob(b64);
  return JSON.parse(json) as T;
}

export function jwtExpired(token: string, skewSec = 30): boolean {
  try {
    const p = decodeJwt<{ exp?: number }>(token);
    if (!p.exp) return true;
    return p.exp - skewSec <= Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}
