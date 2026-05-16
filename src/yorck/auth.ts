import type { Env } from "../types.ts";
import { decodeJwt, jwtExpired } from "../lib/jwt.ts";

const KV_KEY = "yorck:tokens";

interface SigninResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

interface CachedSession {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  cachedAtMs: number;
}

interface IdTokenClaims {
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  "custom:vistaAccessToken2"?: string;
  "custom:vistaRefreshToken2"?: string;
  "custom:vistaMemberId"?: string;
  exp: number;
}

async function signin(env: Env): Promise<CachedSession> {
  if (!env.YORCK_EMAIL || !env.YORCK_PASSWORD) {
    throw new Error("YORCK_EMAIL / YORCK_PASSWORD secrets not set");
  }
  const r = await fetch(`${env.YORCK_AUTH_BASE}/auth/signin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.yorck.de",
      Referer: "https://www.yorck.de/",
      "User-Agent": "Mozilla/5.0 (yorck-mcp)",
    },
    body: JSON.stringify({ email: env.YORCK_EMAIL, password: env.YORCK_PASSWORD }),
  });
  if (!r.ok) throw new Error(`signin ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as SigninResponse;
  if (!j.idToken || !j.accessToken) {
    throw new Error(`signin: missing tokens in response ${JSON.stringify(j).slice(0, 200)}`);
  }
  const session: CachedSession = {
    accessToken: j.accessToken,
    idToken: j.idToken,
    refreshToken: j.refreshToken,
    cachedAtMs: Date.now(),
  };
  // The Cognito access/id tokens are 1h. Cache for ~55 min.
  await env.CACHE.put(KV_KEY, JSON.stringify(session), { expirationTtl: 55 * 60 });
  return session;
}

async function refreshSession(env: Env, refreshToken: string): Promise<CachedSession> {
  const r = await fetch(`${env.YORCK_AUTH_BASE}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.yorck.de",
      Referer: "https://www.yorck.de/",
      "User-Agent": "Mozilla/5.0 (yorck-mcp)",
    },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) throw new Error(`refresh ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as SigninResponse;
  const session: CachedSession = {
    accessToken: j.accessToken,
    idToken: j.idToken,
    refreshToken: j.refreshToken ?? refreshToken,
    cachedAtMs: Date.now(),
  };
  await env.CACHE.put(KV_KEY, JSON.stringify(session), { expirationTtl: 55 * 60 });
  return session;
}

export async function getSession(env: Env, force = false): Promise<CachedSession> {
  if (!force) {
    const cached = await env.CACHE.get<CachedSession>(KV_KEY, "json");
    if (cached && !jwtExpired(cached.idToken, 60)) {
      return cached;
    }
    if (cached?.refreshToken) {
      try {
        return await refreshSession(env, cached.refreshToken);
      } catch {
        // fall through to fresh signin
      }
    }
  }
  return signin(env);
}

export interface VistaAuthHeaders {
  "id-token": string;
  "access-token": string;
  "refresh-token": string;
  connectApiToken: string;
}

export async function authHeaders(env: Env): Promise<VistaAuthHeaders> {
  const s = await getSession(env);
  return {
    "id-token": s.idToken,
    "access-token": s.accessToken,
    "refresh-token": s.refreshToken,
    connectApiToken: "",
  };
}

// Forces fresh tokens if a call fails with an auth error.
export async function withFreshAuthRetry<T>(env: Env, fn: (h: VistaAuthHeaders) => Promise<T>): Promise<T> {
  let h = await authHeaders(env);
  try {
    return await fn(h);
  } catch (e) {
    const msg = String(e);
    if (
      msg.includes("ExpiredLoyaltyToken") ||
      msg.includes("loyaltySessionToken is expired") ||
      msg.includes("Invalid credentials") ||
      msg.includes("ExpiredToken") ||
      msg.includes("401") ||
      msg.includes("403")
    ) {
      const fresh = await getSession(env, true);
      h = {
        "id-token": fresh.idToken,
        "access-token": fresh.accessToken,
        "refresh-token": fresh.refreshToken,
        connectApiToken: "",
      };
      return await fn(h);
    }
    throw e;
  }
}

export async function whoAmI(env: Env): Promise<{ memberId: string; email: string; name: string }> {
  const s = await getSession(env);
  const claims = decodeJwt<IdTokenClaims>(s.idToken);
  const fullName = `${claims.given_name ?? ""} ${claims.family_name ?? ""}`.trim();
  return {
    memberId: claims["custom:vistaMemberId"] ?? "",
    email: claims.email,
    name: fullName || claims.name || claims.given_name || "",
  };
}
