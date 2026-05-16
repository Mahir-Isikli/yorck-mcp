import type { Env, Showtime } from "../types.ts";
import { withBuildId } from "./buildId.ts";
import { fixYorckTime, addMinutesIso, nowBerlinIso, todayBerlinDate } from "../lib/tz.ts";
import { getCinemasMap } from "./cinemas.ts";

interface RawFilm {
  sys: { id: string };
  fields: {
    title: string;
    slug: string;
    vistaId?: string;
    runtime?: number;
    fsk?: number;
    mainLabel?: string;
    tagline?: string;
    yorckPick?: boolean;
    releaseDate?: string;
    distributor?: string;
    descriptors?: string[];
    sessions?: Array<{
      sys: { id: string };
      fields: {
        startTime: string;
        formats?: string[];
        cinema?: { fields?: { name?: string } };
      };
    }>;
  };
}

interface FilmsResponse {
  pageProps: {
    films: RawFilm[];
    activeDates?: Array<{ date: string; active: boolean }>;
    comingSoon?: RawFilm[];
  };
}

const FILMS_KEY = "yorck:films";
const FILMS_TTL = 300; // 5 min

async function fetchFilmsRaw(env: Env): Promise<FilmsResponse> {
  const cached = await env.CACHE.get(FILMS_KEY, "json");
  if (cached) return cached as FilmsResponse;

  const data = await withBuildId(env, async (buildId) => {
    const url = `${env.YORCK_BASE}/_next/data/${buildId}/en/films.json`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (yorck-mcp)" } });
    if (!res.ok) throw new Error(`films.json HTTP ${res.status}`);
    return (await res.json()) as FilmsResponse;
  });

  await env.CACHE.put(FILMS_KEY, JSON.stringify(data), { expirationTtl: FILMS_TTL });
  return data;
}

export interface FilmFilters {
  when?: "now" | "tonight" | "tomorrow" | "weekend" | "week" | string; // or YYYY-MM-DD
  date?: string; // YYYY-MM-DD
  cinemas?: string[]; // cinema slugs
  formats?: string[]; // "OmU","OmeU","OV","DF",...
  preferEnglish?: boolean;
  genres?: string[];
  fskMax?: number;
  runtimeMax?: number;
  after?: string; // HH:MM
  before?: string; // HH:MM
  yorckPick?: boolean;
  district?: string[];
  query?: string; // full-text
}

const FORMAT_PRIORITY: Record<string, number> = { OmeU: 4, OV: 3, OmU: 2, DF: 1 };

function bestFormat(formats: string[], preferEnglish: boolean): string {
  if (!formats.length) return "";
  const ranked = [...formats].sort(
    (a, b) => (FORMAT_PRIORITY[b] ?? 0) - (FORMAT_PRIORITY[a] ?? 0)
  );
  if (preferEnglish && ranked.includes("OmeU")) return "OmeU";
  return ranked[0];
}

function toBerlinDate(iso: string): { date: string; hour: number; minute: number } {
  const fixed = fixYorckTime(iso);
  const m = fixed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) return { date: iso.slice(0, 10), hour: 0, minute: 0 };
  return { date: m[1], hour: +m[2], minute: +m[3] };
}

function dateMatches(when: string | undefined, date: string | undefined, sessionDate: string): boolean {
  if (date) return date === sessionDate;
  if (!when) return true;
  const today = todayBerlinDate();
  if (when === "today" || when === "tonight" || when === "now") return sessionDate === today;
  if (when === "tomorrow") {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + 1);
    return sessionDate === t.toISOString().slice(0, 10);
  }
  if (when === "weekend") {
    const t = new Date(sessionDate);
    const dow = t.getUTCDay();
    return dow === 5 || dow === 6 || dow === 0; // Fri, Sat, Sun
  }
  if (when === "week") {
    const today_ = new Date(today);
    const target = new Date(sessionDate);
    const diff = (target.getTime() - today_.getTime()) / 86400_000;
    return diff >= 0 && diff < 7;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(when)) return sessionDate === when;
  return true;
}

function timeOfDayMatches(after: string | undefined, before: string | undefined, hour: number, minute: number): boolean {
  const cur = hour * 60 + minute;
  if (after) {
    const [h, m] = after.split(":").map(Number);
    if (cur < h * 60 + (m ?? 0)) return false;
  }
  if (before) {
    const [h, m] = before.split(":").map(Number);
    if (cur > h * 60 + (m ?? 0)) return false;
  }
  return true;
}

export async function searchShowtimes(env: Env, f: FilmFilters): Promise<Showtime[]> {
  const data = await fetchFilmsRaw(env);
  const cinemas = await getCinemasMap(env);

  // Resolve "preferred cinemas" default
  const allowedCinemaSlugs = new Set(
    f.cinemas?.length ? f.cinemas : env.PREFERRED_CINEMAS.split(",").map((s) => s.trim())
  );
  const allowedFormats = new Set(
    f.formats?.length ? f.formats : env.DEFAULT_FORMATS.split(",").map((s) => s.trim())
  );

  // Map cinema name -> slug + district (Yorck stores name in sessions, slug in cinemas.json)
  const nameToSlug = new Map<string, string>();
  for (const c of cinemas.values()) nameToSlug.set(c.name.trim(), c.slug);

  const out: Showtime[] = [];
  const now = nowBerlinIso();
  const isFuture = (iso: string) => fixYorckTime(iso) >= now;

  for (const film of data.pageProps.films) {
    const ff = film.fields;
    if (f.genres?.length && !f.genres.includes(ff.mainLabel ?? "")) continue;
    if (typeof f.fskMax === "number" && (ff.fsk ?? 0) > f.fskMax) continue;
    if (typeof f.runtimeMax === "number" && (ff.runtime ?? 0) > f.runtimeMax) continue;
    if (f.yorckPick && !ff.yorckPick) continue;
    if (f.query) {
      const q = f.query.toLowerCase();
      const hay = (ff.title + " " + (ff.tagline ?? "")).toLowerCase();
      if (!hay.includes(q)) continue;
    }

    for (const s of ff.sessions ?? []) {
      const sf = s.fields;
      const cinemaName = sf.cinema?.fields?.name?.trim() ?? "";
      const cinemaSlug = nameToSlug.get(cinemaName);
      if (!cinemaSlug || !allowedCinemaSlugs.has(cinemaSlug)) continue;

      const sessionFormats = sf.formats ?? [];
      const matchedFormat = sessionFormats.find((x) => allowedFormats.has(x));
      if (!matchedFormat) continue;

      if (!isFuture(sf.startTime)) continue;

      const { date, hour, minute } = toBerlinDate(sf.startTime);
      if (!dateMatches(f.when, f.date, date)) continue;
      if (!timeOfDayMatches(f.after, f.before, hour, minute)) continue;

      const cinemaInfo = cinemas.get(cinemaSlug);
      if (f.district?.length && cinemaInfo && !f.district.includes(cinemaInfo.district)) continue;

      const start = fixYorckTime(sf.startTime);
      const end = ff.runtime ? addMinutesIso(start, ff.runtime) : start;

      out.push({
        film: ff.title,
        slug: ff.slug,
        tagline: ff.tagline,
        runtime: ff.runtime ?? 0,
        fsk: ff.fsk,
        genre: ff.mainLabel,
        yorckPick: !!ff.yorckPick,
        start,
        end,
        cinema: cinemaName,
        cinemaSlug,
        district: cinemaInfo?.district,
        format: bestFormat(sessionFormats.filter((x) => allowedFormats.has(x)), !!f.preferEnglish),
        url: `${env.YORCK_BASE}/en/films/${ff.slug}`,
        sessionId: s.sys.id,
      });
    }
  }

  // Sort by start time, then preferred-format priority
  out.sort((a, b) => {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    return (FORMAT_PRIORITY[b.format] ?? 0) - (FORMAT_PRIORITY[a.format] ?? 0);
  });

  return out;
}

export async function findFilmBySlug(env: Env, slug: string) {
  const data = await fetchFilmsRaw(env);
  return data.pageProps.films.find((f) => f.fields.slug === slug);
}

export async function findFilmsByQuery(env: Env, query: string, limit = 5) {
  const data = await fetchFilmsRaw(env);
  const q = query.toLowerCase();
  const matches = data.pageProps.films.filter((f) => {
    const ff = f.fields;
    const hay = `${ff.title} ${ff.tagline ?? ""} ${ff.distributor ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
  return matches.slice(0, limit).map((f) => ({
    title: f.fields.title,
    slug: f.fields.slug,
    runtime: f.fields.runtime ?? 0,
    fsk: f.fields.fsk,
    genre: f.fields.mainLabel,
    tagline: f.fields.tagline,
    sessionsCount: f.fields.sessions?.length ?? 0,
    url: `${env.YORCK_BASE}/en/films/${f.fields.slug}`,
  }));
}

export async function getComingSoon(env: Env) {
  const data = await fetchFilmsRaw(env);
  return (data.pageProps.comingSoon ?? []).map((f) => ({
    title: f.fields.title,
    slug: f.fields.slug,
    runtime: f.fields.runtime ?? 0,
    fsk: f.fields.fsk,
    genre: f.fields.mainLabel,
    tagline: f.fields.tagline,
    releaseDate: f.fields.releaseDate,
    url: `${env.YORCK_BASE}/en/films/${f.fields.slug}`,
  }));
}
