import type { Cinema, Env } from "../types.ts";
import { withBuildId } from "./buildId.ts";

const KEY = "yorck:cinemas";
const TTL = 1800; // 30 min

interface RawCinemasResponse {
  pageProps: {
    cinemas: Array<{
      fields: {
        name: string;
        shortName: string;
        slug: string;
        vistaId: string;
        district: string;
        address: string;
        coordinates?: { lat: number; lon: number };
        numberOfAuditoriums?: number;
      };
    }>;
  };
}

export async function getCinemas(env: Env): Promise<Cinema[]> {
  const cached = await env.CACHE.get(KEY, "json");
  if (cached) return cached as Cinema[];

  const data = await withBuildId(env, async (buildId) => {
    const url = `${env.YORCK_BASE}/_next/data/${buildId}/en/cinemas.json`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (yorck-mcp)" } });
    if (!res.ok) throw new Error(`cinemas.json HTTP ${res.status}`);
    return (await res.json()) as RawCinemasResponse;
  });

  const cinemas: Cinema[] = data.pageProps.cinemas.map((c) => ({
    name: c.fields.name,
    slug: c.fields.slug,
    shortName: c.fields.shortName,
    vistaId: c.fields.vistaId,
    district: c.fields.district,
    address: c.fields.address,
    coordinates: c.fields.coordinates,
    numberOfAuditoriums: c.fields.numberOfAuditoriums,
  }));

  await env.CACHE.put(KEY, JSON.stringify(cinemas), { expirationTtl: TTL });
  return cinemas;
}

export async function getCinemasMap(env: Env): Promise<Map<string, Cinema>> {
  const cinemas = await getCinemas(env);
  return new Map(cinemas.map((c) => [c.slug, c]));
}

export async function getCinemaBySlug(env: Env, slug: string): Promise<Cinema | undefined> {
  const map = await getCinemasMap(env);
  return map.get(slug);
}

// Lookup cinema by Vista numeric id (e.g. "1009").
export async function getCinemaByVistaId(env: Env, vistaId: string): Promise<Cinema | undefined> {
  const cinemas = await getCinemas(env);
  return cinemas.find((c) => c.vistaId === vistaId);
}
