#!/usr/bin/env tsx
import { mkdir, writeFile } from "node:fs/promises";
import process from "node:process";
import readline from "node:readline/promises";
import type { Env, Showtime } from "./types.ts";
import { findFilmsByQuery, getComingSoon, searchShowtimes, type FilmFilters } from "./yorck/films.ts";
import { getCinemas, getCinemaBySlug } from "./yorck/cinemas.ts";
import { findSeatByRowAndId, getSeatPlan, renderSeatPlanHtml, renderSeatPlanSvg } from "./yorck/seats.ts";
import { cancelOrder, commitOrder, reserveUnlimited } from "./yorck/booking.ts";
import { showtimeToIcs } from "./lib/ics.ts";
import { whoAmI } from "./yorck/auth.ts";
import { CLAUDE_CODE_BOOTSTRAP_PROMPT, YORCK_MOVIE_AGENT_SKILL } from "./skill-content.ts";

const PUBLIC_MCP_URL = "https://yorck-mcp.isiklimahir.workers.dev/public/mcp";

const DEFAULTS = {
  PREFERRED_CINEMAS: "babylon-kreuzberg,delphi-filmpalast,delphi-lux,filmtheater-am-friedrichshain,kant-kino,kino-international,neues-off,odeon,passage,rollberg,yorck",
  DEFAULT_FORMATS: "OmeU,OV,OmU",
  COGNITO_USER_POOL: "eu-central-1_TIusy2VuG",
  COGNITO_CLIENT_ID: "4m9hc0qk59mvcb4hfd6lep1262",
  COGNITO_REGION: "eu-central-1",
  VISTA_BASE: "https://uq8lgoj7z2.execute-api.eu-central-1.amazonaws.com/production/api/vista",
  YORCK_AUTH_BASE: "https://rbfmu7cs19.execute-api.eu-central-1.amazonaws.com/production",
  YORCK_BASE: "https://www.yorck.de",
  PUBLIC_BASE_URL: "https://yorck-mcp.isiklimahir.workers.dev",
};

type ParsedArgs = { _: string[]; [key: string]: string | boolean | string[] };

type KvRecord = { value: string; expiresAt?: number };

class MemoryKv {
  private store = new Map<string, KvRecord>();

  async get(key: string, type?: "text" | "json" | "arrayBuffer" | "stream") {
    const record = this.store.get(key);
    if (!record) return null;
    if (record.expiresAt && Date.now() > record.expiresAt) {
      this.store.delete(key);
      return null;
    }
    if (type === "json") return JSON.parse(record.value);
    if (type === "arrayBuffer") return new TextEncoder().encode(record.value).buffer;
    return record.value;
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number }) {
    if (typeof value !== "string") throw new Error("CLI MemoryKv only supports string values");
    this.store.set(key, {
      value,
      expiresAt: options?.expirationTtl ? Date.now() + options.expirationTtl * 1000 : undefined,
    });
  }
}

function envFromProcess(): Env {
  return {
    CACHE: new MemoryKv() as unknown as KVNamespace,
    MCP_OBJECT: undefined as unknown as DurableObjectNamespace,
    PUBLIC_MCP_OBJECT: undefined as unknown as DurableObjectNamespace,
    BROWSER: undefined as unknown as Fetcher,
    PREFERRED_CINEMAS: process.env.YORCK_PREFERRED_CINEMAS || DEFAULTS.PREFERRED_CINEMAS,
    DEFAULT_FORMATS: process.env.YORCK_DEFAULT_FORMATS || DEFAULTS.DEFAULT_FORMATS,
    COGNITO_USER_POOL: process.env.COGNITO_USER_POOL || DEFAULTS.COGNITO_USER_POOL,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || DEFAULTS.COGNITO_CLIENT_ID,
    COGNITO_REGION: process.env.COGNITO_REGION || DEFAULTS.COGNITO_REGION,
    VISTA_BASE: process.env.VISTA_BASE || DEFAULTS.VISTA_BASE,
    YORCK_AUTH_BASE: process.env.YORCK_AUTH_BASE || DEFAULTS.YORCK_AUTH_BASE,
    YORCK_BASE: process.env.YORCK_BASE || DEFAULTS.YORCK_BASE,
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || DEFAULTS.PUBLIC_BASE_URL,
    YORCK_EMAIL: process.env.YORCK_EMAIL,
    YORCK_PASSWORD: process.env.YORCK_PASSWORD,
    YORCK_UNLIMITED_CARD: process.env.YORCK_UNLIMITED_CARD,
    YORCK_MCP_AUTH_TOKEN: process.env.YORCK_MCP_AUTH_TOKEN,
  };
}

function parseArgv(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("-")) {
      out._.push(arg);
      continue;
    }
    if (arg === "--") {
      out._.push(...argv.slice(i + 1));
      break;
    }
    const normalized = arg.replace(/^--?/, "");
    const [rawKey, inline] = normalized.split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const next = argv[i + 1];
    let value: string | boolean = true;
    if (inline !== undefined) value = inline;
    else if (next && !next.startsWith("-")) {
      value = next;
      i++;
    }
    if (out[key] === undefined) out[key] = value;
    else if (Array.isArray(out[key])) (out[key] as string[]).push(String(value));
    else out[key] = [String(out[key]), String(value)];
  }
  return out;
}

function str(args: ParsedArgs, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = args[name];
    if (typeof v === "string") return v;
    if (typeof v === "boolean" && v) return "true";
    if (Array.isArray(v)) return v[v.length - 1];
  }
  return undefined;
}

function bool(args: ParsedArgs, name: string, defaultValue = false): boolean {
  const v = args[name];
  if (v === undefined) return defaultValue;
  if (typeof v === "boolean") return v;
  return !["false", "0", "no", "off"].includes(String(v).toLowerCase());
}

function csv(args: ParsedArgs, name: string): string[] | undefined {
  const v = args[name];
  const values = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const parts = values.flatMap((x) => x.split(",").map((s) => s.trim()).filter(Boolean));
  return parts.length ? parts : undefined;
}

function intOpt(args: ParsedArgs, name: string): number | undefined {
  const v = str(args, name);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function filters(args: ParsedArgs): FilmFilters {
  return {
    when: str(args, "when") as FilmFilters["when"],
    date: str(args, "date"),
    cinemas: csv(args, "cinemas"),
    formats: csv(args, "formats") ?? (bool(args, "includeGermanDub") ? ["OmeU", "OV", "OmU", "DF"] : undefined),
    preferEnglish: args.preferEnglish === undefined ? undefined : bool(args, "preferEnglish"),
    genres: csv(args, "genres"),
    fskMax: intOpt(args, "fskMax"),
    runtimeMax: intOpt(args, "runtimeMax"),
    after: str(args, "after"),
    before: str(args, "before"),
    yorckPick: args.yorckPick === undefined ? undefined : bool(args, "yorckPick"),
    district: csv(args, "district"),
    query: str(args, "query", "q") ?? (args._.join(" ") || undefined),
  };
}

function printJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function shortTime(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]}` : iso;
}

function sessionBookingUrl(env: Env, showtime: Showtime): string {
  return `${env.YORCK_BASE.replace(/\/$/, "")}/en/checkout/seats?sessionid=${encodeURIComponent(showtime.sessionId)}`;
}

function printShowtimes(showtimes: Showtime[], limit = 20) {
  if (!showtimes.length) {
    console.log("No matching showtimes.");
    return;
  }
  const rows = showtimes.slice(0, limit).map((s, i) => ({
    "#": i + 1,
    time: shortTime(s.start),
    film: s.film,
    cinema: s.cinemaSlug,
    format: s.format,
    session: s.sessionId,
  }));
  console.table(rows);
  if (showtimes.length > limit) console.log(`Showing ${limit}/${showtimes.length}. Use --json for all results.`);
}

async function ask(question: string, hidden = false): Promise<string> {
  if (!hidden || !process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }

  process.stdout.write(question);
  process.stdin.setRawMode?.(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  let answer = "";
  return await new Promise<string>((resolve, reject) => {
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          cleanup();
          reject(new Error("cancelled"));
          return;
        }
        if (ch === "\r" || ch === "\n") {
          process.stdout.write("\n");
          cleanup();
          resolve(answer.trim());
          return;
        }
        if (ch === "\u007f") {
          answer = answer.slice(0, -1);
          continue;
        }
        answer += ch;
        process.stdout.write("*");
      }
    };
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
    };
    process.stdin.on("data", onData);
  });
}

async function ensureCredentials(env: Env, args: ParsedArgs): Promise<Env> {
  env.YORCK_EMAIL = str(args, "email") || env.YORCK_EMAIL || await ask("Yorck email: ");
  env.YORCK_PASSWORD = str(args, "password") || env.YORCK_PASSWORD || await ask("Yorck password: ", true);
  env.YORCK_UNLIMITED_CARD = str(args, "card", "unlimitedCard") || env.YORCK_UNLIMITED_CARD || await ask("Yorck Unlimited card number: ");
  return env;
}

function seatRowsFromPlan(plan: any) {
  return (plan.SeatLayoutData?.Areas?.[0]?.Rows ?? []).map((row: any) => ({
    physicalName: row.PhysicalName,
    rowIndex: row.RowIndexZeroBased,
    availableIds: (row.Seats ?? []).filter((seat: any) => seat.Status === 0).map((seat: any) => seat.Id),
  }));
}

function rankShowtimes(showtimes: Showtime[]) {
  const priority: Record<string, number> = { OmeU: 4, OV: 3, OmU: 2, DF: 1 };
  return [...showtimes].sort((a, b) => {
    const fp = (priority[b.format] ?? 0) - (priority[a.format] ?? 0);
    if (fp !== 0) return fp;
    return a.start.localeCompare(b.start);
  });
}

function pickSeat(rows: Array<{ physicalName: string; rowIndex: number; availableIds: Array<string | number> }>) {
  const availableRows = rows.filter((row) => row.availableIds?.length);
  if (!availableRows.length) return null;
  const minIndex = Math.min(...availableRows.map((r) => Number(r.rowIndex) || 0));
  const maxIndex = Math.max(...availableRows.map((r) => Number(r.rowIndex) || 0));
  const idealRow = minIndex + (maxIndex - minIndex) * 0.45;
  const row = [...availableRows].sort((a, b) => {
    const aDist = Math.abs((Number(a.rowIndex) || 0) - idealRow);
    const bDist = Math.abs((Number(b.rowIndex) || 0) - idealRow);
    if (aDist !== bDist) return aDist - bDist;
    return (b.availableIds.length || 0) - (a.availableIds.length || 0);
  })[0]!;
  const seats = [...row.availableIds].sort((a, b) => Number(a) - Number(b));
  return { rowLabel: String(row.physicalName), seatId: String(seats[Math.floor((seats.length - 1) / 2)]), availableSeatsInRow: seats.map(String) };
}

async function seatPlanForSession(env: Env, sessionId: string) {
  const [cinemaVistaId, sessionNum] = sessionId.split("-");
  if (!cinemaVistaId || !sessionNum) throw new Error("sessionId must look like 1009-5990");
  const plan = await getSeatPlan(env, cinemaVistaId, sessionNum);
  const cinema = (await getCinemas(env)).find((c) => c.vistaId === cinemaVistaId);
  return { plan, cinema, cinemaVistaId, sessionNum, rows: seatRowsFromPlan(plan) };
}

async function bookSpecific(env: Env, args: ParsedArgs, selection: { sessionId: string; cinemaSlug: string; rowLabel: string; seatId: string; showtime?: Showtime }) {
  await ensureCredentials(env, args);
  const realBooking = bool(args, "commit") || bool(args, "confirm") || bool(args, "book");
  if (realBooking && !bool(args, "yes")) {
    const answer = await ask(`This will actually book ${selection.sessionId} row ${selection.rowLabel} seat ${selection.seatId}. Type BOOK to continue: `);
    if (answer !== "BOOK") throw new Error("booking cancelled");
  }

  const reservation = await reserveUnlimited(env, selection);
  const summary = {
    approved: reservation.approved,
    ticketTypeCode: reservation.ticketTypeCode,
    orderTotal: reservation.order.orderTotalValueInCents / 100,
    expiresAt: reservation.expiresAt,
    seat: { row: selection.rowLabel, seat: selection.seatId },
    film: reservation.order.sessions[0]?.filmTitle ?? selection.showtime?.film,
    start: reservation.order.sessions[0]?.startTime ?? selection.showtime?.start,
    sessionId: selection.sessionId,
    cinema: selection.cinemaSlug,
    userSessionId: reservation.order.userSessionId,
  };

  if (!realBooking) {
    await cancelOrder(env, reservation.order.userSessionId).catch(() => undefined);
    return { ok: true, dryRun: true, note: "Unlimited validated, hold released. Add --commit --yes to actually book.", ...summary };
  }

  if (!reservation.approved) {
    await cancelOrder(env, reservation.order.userSessionId).catch(() => undefined);
    throw new Error("Unlimited validation did not approve this ticket");
  }
  const commit = await commitOrder(env, reservation.order.userSessionId);
  return { ok: true, dryRun: false, ...summary, commit };
}

async function commandWhatsOn(env: Env, args: ParsedArgs) {
  const out = await searchShowtimes(env, filters(args));
  if (bool(args, "json")) printJson({ count: out.length, showtimes: out });
  else printShowtimes(out, intOpt(args, "limit") ?? 20);
}

async function commandSearch(env: Env, args: ParsedArgs) {
  const query = str(args, "query", "q") ?? args._.join(" ");
  if (!query) throw new Error("usage: yorck search <query>");
  printJson(await findFilmsByQuery(env, query, intOpt(args, "limit") ?? 8));
}

async function commandShowtimes(env: Env, args: ParsedArgs) {
  const slug = args._[0] || str(args, "slug");
  if (!slug) throw new Error("usage: yorck showtimes <film-slug>");
  const out = (await searchShowtimes(env, { ...filters(args), query: undefined })).filter((s) => s.slug === slug);
  if (bool(args, "json")) printJson({ count: out.length, showtimes: out });
  else printShowtimes(out, intOpt(args, "limit") ?? 20);
}

async function commandSeatMap(env: Env, args: ParsedArgs) {
  const sessionId = args._[0] || str(args, "sessionId");
  if (!sessionId) throw new Error("usage: yorck seat-map <session-id> [--out seat-map.svg]");
  const { plan, cinema, rows } = await seatPlanForSession(env, sessionId);
  const svg = renderSeatPlanSvg(plan, { title: cinema?.name ?? "Yorck", subtitle: `Session ${sessionId}` });
  const out = str(args, "out");
  if (out) {
    await writeFile(out, svg, "utf8");
    console.log(`Wrote ${out}`);
  }
  printJson({ sessionId, cinema: cinema?.name, rows, svg: out ? undefined : svg });
}

async function commandSeatMapHtml(env: Env, args: ParsedArgs) {
  const sessionId = args._[0] || str(args, "sessionId");
  if (!sessionId) throw new Error("usage: yorck seat-map-html <session-id> [--out seat-map.html]");
  const { plan, cinema, rows } = await seatPlanForSession(env, sessionId);
  const html = renderSeatPlanHtml(plan, { title: cinema?.name ?? "Yorck", subtitle: `Session ${sessionId}` });
  const out = str(args, "out");
  if (out) {
    await writeFile(out, html, "utf8");
    console.log(`Wrote ${out}`);
  }
  printJson({ sessionId, cinema: cinema?.name, rows, html: out ? undefined : html });
}

async function commandCalendar(env: Env, args: ParsedArgs) {
  const sessionId = args._[0] || str(args, "sessionId");
  const slug = args._[1] || str(args, "slug");
  if (!sessionId || !slug) throw new Error("usage: yorck calendar <session-id> <film-slug> [--out event.ics]");
  const all = await searchShowtimes(env, { cinemas: undefined, formats: ["OmeU", "OV", "OmU", "DF"] });
  const showtime = all.find((s) => s.sessionId === sessionId && s.slug === slug);
  if (!showtime) throw new Error("session not found in current showtimes");
  const cinema = (await getCinemas(env)).find((c) => c.slug === showtime.cinemaSlug);
  const ics = showtimeToIcs(showtime, cinema?.address);
  const out = str(args, "out");
  if (out) {
    await writeFile(out, ics, "utf8");
    console.log(`Wrote ${out}`);
  } else {
    process.stdout.write(ics);
  }
}

async function commandBook(env: Env, args: ParsedArgs) {
  const sessionId = args._[0] || str(args, "sessionId");
  const cinemaSlug = str(args, "cinema", "cinemaSlug");
  const rowLabel = str(args, "row", "rowLabel");
  const seatId = str(args, "seat", "seatId");
  if (!sessionId || !cinemaSlug || !rowLabel || !seatId) {
    throw new Error("usage: yorck book <session-id> --cinema passage --row 8 --seat 12 [--commit --yes]");
  }
  printJson(await bookSpecific(env, args, { sessionId, cinemaSlug, rowLabel, seatId }));
}

async function pickBestShowtime(env: Env, args: ParsedArgs) {
  const search = await searchShowtimes(env, filters(args));
  const candidates = rankShowtimes(search).slice(0, intOpt(args, "candidates") ?? 8);
  for (const showtime of candidates) {
    try {
      const { rows } = await seatPlanForSession(env, showtime.sessionId);
      const seat = pickSeat(rows);
      if (!seat) continue;
      return { showtime, seat, seatPlanSummary: rows };
    } catch (error) {
      if (bool(args, "verbose")) console.error(`Skipping ${showtime.sessionId}: ${String(error)}`);
    }
  }
  return null;
}

async function commandPlan(env: Env, args: ParsedArgs) {
  const picked = await pickBestShowtime(env, args);
  if (!picked) throw new Error("No matching showtime with available seats found");
  const { showtime, seat, seatPlanSummary } = picked;
  printJson({
    ok: true,
    selected: showtime,
    manualBookingUrl: sessionBookingUrl(env, showtime),
    filmPageUrl: showtime.url,
    apiSeatForAutomation: { row: seat.rowLabel, seatId: seat.seatId },
    note: "No Yorck account or Unlimited card needed. This does not reserve the seat; use the Yorck checkout page to choose and book manually. apiSeatForAutomation is for the booking API, not necessarily the visible seat label on Yorck's website.",
    next: {
      seatMap: `npx yorck-mcp seat-map ${showtime.sessionId} --out seat-map.svg`,
      calendar: `npx yorck-mcp calendar ${showtime.sessionId} ${showtime.slug} --out movie.ics`,
      unlimitedDryRun: `YORCK_EMAIL=... YORCK_PASSWORD=... YORCK_UNLIMITED_CARD=... npx yorck-mcp book-best --q ${JSON.stringify(showtime.film)} --when tonight`,
    },
    seatPlanSummary,
  });
}

async function commandBookBest(env: Env, args: ParsedArgs) {
  const picked = await pickBestShowtime(env, args);
  if (!picked) throw new Error("No bookable showtime with available seats found");
  const { showtime, seat, seatPlanSummary } = picked;
  const booking = await bookSpecific(env, args, {
    sessionId: showtime.sessionId,
    cinemaSlug: showtime.cinemaSlug,
    rowLabel: seat.rowLabel,
    seatId: seat.seatId,
    showtime,
  });
  printJson({ selected: { ...showtime, seat: { row: seat.rowLabel, seat: seat.seatId } }, booking, seatPlanSummary });
}

async function commandMe(env: Env, args: ParsedArgs) {
  await ensureCredentials(env, args);
  printJson(await whoAmI(env));
}

async function commandSkill(args: ParsedArgs) {
  const out = str(args, "out");
  if (out) {
    await writeFile(out, YORCK_MOVIE_AGENT_SKILL, "utf8");
    console.log(`Wrote ${out}`);
  } else {
    process.stdout.write(YORCK_MOVIE_AGENT_SKILL);
  }
}

async function commandClaudeCodePrompt(args: ParsedArgs) {
  const out = str(args, "out");
  if (out) {
    await writeFile(out, CLAUDE_CODE_BOOTSTRAP_PROMPT, "utf8");
    console.log(`Wrote ${out}`);
  } else {
    process.stdout.write(CLAUDE_CODE_BOOTSTRAP_PROMPT);
  }
}

async function commandInstallSkill(args: ParsedArgs) {
  const target = (str(args, "target") || "claude").toLowerCase();
  const home = process.env.HOME || process.cwd();
  const destinations: string[] = [];
  if (target === "claude" || target === "both") destinations.push(`${home}/.claude/skills/yorck-movie-agent`);
  if (target === "pi" || target === "both") destinations.push(`${home}/.pi/agent/skills/yorck-movie-agent`);
  const customDest = str(args, "dest");
  if (customDest) destinations.splice(0, destinations.length, customDest.replace(/^~/, home));
  if (!destinations.length) throw new Error("usage: yorck install-skill [--target claude|pi|both] [--dest path]");
  for (const dest of destinations) {
    await mkdir(dest, { recursive: true });
    await writeFile(`${dest}/SKILL.md`, YORCK_MOVIE_AGENT_SKILL, "utf8");
    console.log(`Installed skill to ${dest}/SKILL.md`);
  }
}

function commandMcpConfig(args: ParsedArgs) {
  const privateUrl = str(args, "url") || process.env.YORCK_MCP_URL || "https://yorck-mcp.isiklimahir.workers.dev/mcp";
  if (bool(args, "remotePrivate")) {
    printJson({
      mcpServers: {
        yorck: {
          command: "npx",
          args: ["-y", "mcp-remote", privateUrl],
          env: { YORCK_MCP_AUTH_TOKEN: "<your bearer token>" },
        },
      },
    });
    return;
  }
  if (bool(args, "private") || bool(args, "local")) {
    printJson({
      mcpServers: {
        yorck: {
          command: "npx",
          args: ["-y", "yorck-mcp", "mcp-stdio"],
          env: {
            YORCK_EMAIL: "<your Yorck email>",
            YORCK_PASSWORD: "<your Yorck password>",
            YORCK_UNLIMITED_CARD: "<your Yorck Unlimited card number>",
          },
        },
      },
    });
    return;
  }
  printJson({
    mcpServers: {
      yorck: {
        command: "npx",
        args: ["-y", "mcp-remote", PUBLIC_MCP_URL],
      },
    },
  });
}

function help() {
  console.log(`yorck, CLI + MCP helper for Yorck Berlin cinema

Usage:
  yorck whats-on [--when tonight] [--after 18:00] [--cinemas passage,rollberg] [--q "devil"]
  yorck search <film query>
  yorck showtimes <film-slug> [--date YYYY-MM-DD]
  yorck cinemas
  yorck coming-soon
  yorck seat-map <session-id> [--out seat-map.svg]
  yorck seat-map-html <session-id> [--out seat-map.html]
  yorck calendar <session-id> <film-slug> [--out event.ics]
  yorck plan --q <film> --when tonight --after 18:00
  yorck me [--email you@example.com --password ...]
  yorck book <session-id> --cinema <slug> --row <row> --seat <seat> [--commit --yes]
  yorck book-best --q <film> --when tonight --after 18:00 [--commit --yes]
  yorck mcp-stdio
  yorck mcp-config [--private]
  yorck skill [--out SKILL.md]
  yorck claude-code-prompt [--out prompt.md]
  yorck install-skill [--target claude|pi|both]

Public commands need no account. Booking commands need Yorck credentials and an Unlimited card number.
Use env vars instead of flags for secrets: YORCK_EMAIL, YORCK_PASSWORD, YORCK_UNLIMITED_CARD.
Booking is dry-run by default and releases the hold. Real booking requires --commit and either --yes or typing BOOK.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv.shift();
  const args = parseArgv(argv);
  const env = envFromProcess();

  if (!command || command === "help" || command === "--help" || command === "-h") return help();
  switch (command) {
    case "whats-on":
    case "films":
      return commandWhatsOn(env, args);
    case "search":
    case "find-film":
      return commandSearch(env, args);
    case "showtimes":
      return commandShowtimes(env, args);
    case "cinemas":
      return printJson(await getCinemas(env));
    case "coming-soon":
      return printJson(await getComingSoon(env));
    case "seat-map":
      return commandSeatMap(env, args);
    case "seat-map-html":
      return commandSeatMapHtml(env, args);
    case "calendar":
    case "ics":
      return commandCalendar(env, args);
    case "plan":
    case "pick":
      return commandPlan(env, args);
    case "me":
      return commandMe(env, args);
    case "book":
      return commandBook(env, args);
    case "book-best":
      return commandBookBest(env, args);
    case "mcp-config":
      return commandMcpConfig(args);
    case "skill":
      return commandSkill(args);
    case "claude-code-prompt":
    case "bootstrap-prompt":
      return commandClaudeCodePrompt(args);
    case "install-skill":
      return commandInstallSkill(args);
    case "mcp-stdio":
    case "serve-mcp": {
      const { runLocalMcp } = await import("./local-mcp.ts");
      return runLocalMcp();
    }
    default:
      throw new Error(`Unknown command: ${command}. Run 'yorck help'.`);
  }
}

main().catch((error) => {
  console.error(`yorck: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
