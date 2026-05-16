import type { Env } from "../types.ts";

const KEY = "yorck:buildId";
const TTL = 600; // 10 min

export async function getBuildId(env: Env, force = false): Promise<string> {
  if (!force) {
    const cached = await env.CACHE.get(KEY);
    if (cached) return cached;
  }
  const res = await fetch(env.YORCK_BASE + "/", {
    headers: { "User-Agent": "Mozilla/5.0 (yorck-mcp)" },
  });
  if (!res.ok) throw new Error(`yorck.de homepage HTTP ${res.status}`);
  const html = await res.text();
  const m1 = html.match(/"buildId":"([^"]+)"/);
  const m2 = html.match(/\/_next\/static\/([^/]+)\/_buildManifest/);
  const buildId = m1?.[1] ?? m2?.[1];
  if (!buildId) throw new Error("buildId not found in yorck.de homepage");
  await env.CACHE.put(KEY, buildId, { expirationTtl: TTL });
  return buildId;
}

export async function invalidateBuildId(env: Env): Promise<void> {
  await env.CACHE.delete(KEY);
}

// Wrap a fetch that depends on buildId. Retries once if the data endpoint 404s
// (likely because Yorck rotated their build).
export async function withBuildId<T>(
  env: Env,
  fn: (buildId: string) => Promise<T>
): Promise<T> {
  const buildId = await getBuildId(env);
  try {
    return await fn(buildId);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("404") || msg.includes("not found")) {
      await invalidateBuildId(env);
      const fresh = await getBuildId(env, true);
      return await fn(fresh);
    }
    throw e;
  }
}
