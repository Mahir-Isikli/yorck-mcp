import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Env, Showtime } from "./types.ts";
import { searchShowtimes, findFilmsByQuery, getComingSoon } from "./yorck/films.ts";
import { getCinemas } from "./yorck/cinemas.ts";
import { getSeatPlan, renderSeatPlanHtml, renderSeatPlanSvg } from "./yorck/seats.ts";
import { reserveUnlimited, cancelOrder, commitOrder } from "./yorck/booking.ts";
import { showtimeToIcs } from "./lib/ics.ts";
import { nowBerlinIso } from "./lib/tz.ts";

const FilmFiltersSchema = {
  when: z
    .union([
      z.enum(["now", "tonight", "tomorrow", "weekend", "week"]),
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ])
    .optional()
    .describe("'tonight', 'tomorrow', 'weekend', 'week', or YYYY-MM-DD"),
  cinemas: z
    .array(z.string())
    .optional()
    .describe("cinema slugs, e.g. ['rollberg','delphi-lux']. Defaults to configured preferred cinemas."),
  formats: z
    .array(z.string())
    .optional()
    .describe("'OmeU' (English subs), 'OV' (no subs), 'OmU' (German subs), 'DF' (German dub). Default excludes DF."),
  preferEnglish: z.boolean().optional().describe("bias toward OmeU > OV > OmU when sorting"),
  genres: z.array(z.string()).optional().describe("e.g. ['Drama','Documentary']"),
  fskMax: z.number().int().min(0).max(18).optional(),
  runtimeMax: z.number().int().min(30).max(300).optional(),
  after: z.string().regex(/^\d{1,2}:\d{2}$/).optional().describe("HH:MM, e.g. '18:00'"),
  before: z.string().regex(/^\d{1,2}:\d{2}$/).optional(),
  yorckPick: z.boolean().optional(),
  district: z.array(z.string()).optional(),
  query: z.string().optional().describe("text search across title and tagline"),
};

function project(showtimes: Showtime[], limit = 50): { now: string; count: number; truncated: boolean; showtimes: Showtime[] } {
  return {
    now: nowBerlinIso(),
    count: showtimes.length,
    truncated: showtimes.length > limit,
    showtimes: showtimes.slice(0, limit),
  };
}

function publicBaseUrl(env: Env): string {
  return (env.PUBLIC_BASE_URL || "https://yorck-mcp.isiklimahir.workers.dev").replace(/\/$/, "");
}

function sessionBookingUrl(env: Env, showtime: Showtime): string {
  return `${env.YORCK_BASE.replace(/\/$/, "")}/en/checkout/seats?sessionid=${encodeURIComponent(showtime.sessionId)}`;
}

function rankShowtimes(showtimes: Showtime[]) {
  const priority: Record<string, number> = { OmeU: 4, OV: 3, OmU: 2, DF: 1 };
  return [...showtimes].sort((a, b) => {
    const fp = (priority[b.format] ?? 0) - (priority[a.format] ?? 0);
    if (fp !== 0) return fp;
    return a.start.localeCompare(b.start);
  });
}

function seatRowsFromPlan(plan: Awaited<ReturnType<typeof getSeatPlan>>) {
  return (plan.SeatLayoutData.Areas[0]?.Rows ?? []).map((row) => ({
    physicalName: String(row.PhysicalName ?? row.RowIndexZeroBased),
    rowIndex: row.RowIndexZeroBased,
    availableIds: (row.Seats ?? []).filter((seat) => seat.Status === 0).map((seat) => seat.Id),
  }));
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
  return { rowLabel: String(row.physicalName), seatId: String(seats[Math.floor((seats.length - 1) / 2)]) };
}

async function pickBestShowtime(env: Env, filters: Parameters<typeof searchShowtimes>[1], candidatesLimit = 8) {
  const showtimes = rankShowtimes(await searchShowtimes(env, filters)).slice(0, candidatesLimit);
  for (const showtime of showtimes) {
    const [cinemaVistaId, sessionNum] = showtime.sessionId.split("-");
    if (!cinemaVistaId || !sessionNum) continue;
    try {
      const plan = await getSeatPlan(env, cinemaVistaId, sessionNum);
      const rows = seatRowsFromPlan(plan);
      const seat = pickSeat(rows);
      if (seat) return { showtime, seat, rows };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

export function registerPublicTools(server: McpServer, env: Env) {
  server.tool(
    "whats_on",
    "Search public Yorck showtimes in Berlin with filters. Use this for everyday 'what is playing tonight / this weekend' queries.",
    FilmFiltersSchema,
    async (args) => {
      const out = await searchShowtimes(env, args);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(project(out), null, 2) }],
      };
    }
  );

  server.tool(
    "find_film",
    "Search for a Yorck film by title, director, or tagline. Returns matches with their slug for showtimes.",
    { query: z.string().min(2), limit: z.number().int().min(1).max(20).optional() },
    async ({ query, limit }) => {
      const matches = await findFilmsByQuery(env, query, limit ?? 5);
      return { content: [{ type: "text" as const, text: JSON.stringify(matches, null, 2) }] };
    }
  );

  server.tool(
    "showtimes",
    "All upcoming sessions for a specific film, optionally filtered by cinema, format, or date.",
    {
      slug: z.string().describe("film slug from find_film"),
      cinemas: z.array(z.string()).optional(),
      formats: z.array(z.string()).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    },
    async ({ slug, cinemas, formats, date }) => {
      const out = (await searchShowtimes(env, { cinemas, formats, date, query: undefined })).filter(
        (s) => s.slug === slug
      );
      return { content: [{ type: "text" as const, text: JSON.stringify(project(out), null, 2) }] };
    }
  );

  server.tool(
    "coming_soon",
    "Films opening at Yorck in the coming weeks.",
    {},
    async () => {
      const upcoming = await getComingSoon(env);
      return { content: [{ type: "text" as const, text: JSON.stringify(upcoming.slice(0, 30), null, 2) }] };
    }
  );

  server.tool(
    "cinemas",
    "List Yorck cinemas with slugs, addresses, districts, and public metadata.",
    {},
    async () => {
      const cinemas = await getCinemas(env);
      return { content: [{ type: "text" as const, text: JSON.stringify(cinemas, null, 2) }] };
    }
  );

  server.tool(
    "seat_map",
    "Returns the public seat plan for a session as an inline SVG image plus visible row and seat IDs. This tool does not reserve or book seats.",
    {
      sessionId: z.string().regex(/^\d{4}-\d+$/).describe("Yorck session id, e.g. '1003-5724'"),
    },
    async ({ sessionId }) => {
      const [cinemaVistaId, sessionNum] = sessionId.split("-");
      const cinema = await (async () => {
        const all = await getCinemas(env);
        return all.find((c) => c.vistaId === cinemaVistaId);
      })();
      if (!cinema) throw new Error(`unknown cinema for session ${sessionId}`);
      const plan = await getSeatPlan(env, cinemaVistaId, sessionNum);
      const svg = renderSeatPlanSvg(plan, {
        title: `${cinema.name}`,
        subtitle: `Session ${sessionId}`,
      });
      const rows = (plan.SeatLayoutData.Areas[0]?.Rows ?? []).map((row) => ({
        physicalName: row.PhysicalName,
        rowIndex: row.RowIndexZeroBased,
        availableIds: (row.Seats ?? []).filter((seat) => seat.Status === 0).map((seat) => seat.Id),
      }));
      const dataUrl = "data:image/svg+xml;base64," + btoa(svg);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ sessionId, cinema: cinema.name, rows }, null, 2) },
          { type: "image" as const, data: dataUrl, mimeType: "image/svg+xml" },
        ],
      };
    }
  );

  server.tool(
    "seat_map_html",
    "Returns a complete inline HTML seat-map page for a session. Use this when the MCP client cannot display SVG/image output directly, such as text-only Claude Code surfaces.",
    {
      sessionId: z.string().regex(/^\d{4}-\d+$/).describe("Yorck session id, e.g. '1003-5724'"),
    },
    async ({ sessionId }) => {
      const [cinemaVistaId, sessionNum] = sessionId.split("-");
      const cinema = await (async () => {
        const all = await getCinemas(env);
        return all.find((c) => c.vistaId === cinemaVistaId);
      })();
      if (!cinema) throw new Error(`unknown cinema for session ${sessionId}`);
      const plan = await getSeatPlan(env, cinemaVistaId, sessionNum);
      const html = renderSeatPlanHtml(plan, {
        title: `${cinema.name}`,
        subtitle: `Session ${sessionId}`,
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ sessionId, cinema: cinema.name, html }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "pick_showtime",
    "Read-only helper that searches showtimes, chooses a reasonable available seat, and returns a manual booking URL. No account, reservation, or payment needed.",
    {
      ...FilmFiltersSchema,
      candidates: z.number().int().min(1).max(20).optional().describe("How many top search results to inspect for available seats. Default 8."),
    },
    async ({ candidates, ...args }) => {
      const picked = await pickBestShowtime(env, args, candidates ?? 8);
      if (!picked) throw new Error("No matching showtime with available seats found");
      const { showtime, seat, rows } = picked;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            selected: showtime,
            manualBookingUrl: sessionBookingUrl(env, showtime),
            filmPageUrl: showtime.url,
            apiSeatForAutomation: { row: seat.rowLabel, seatId: seat.seatId },
            note: "This is a read-only plan and does not reserve the seat. Use Yorck checkout manually, or use book_session with local credentials for the Unlimited booking flow. apiSeatForAutomation is for the booking API, not necessarily the visible seat label on Yorck's website.",
            rows,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "add_to_calendar",
    "Generate an .ics calendar event for a public Yorck showtime.",
    {
      sessionId: z.string().regex(/^\d{4}-\d+$/),
      slug: z.string().describe("film slug"),
    },
    async ({ sessionId, slug }) => {
      const all = await searchShowtimes(env, { cinemas: undefined, formats: ["OmeU", "OV", "OmU", "DF"] });
      const s = all.find((x) => x.sessionId === sessionId && x.slug === slug);
      if (!s) throw new Error("session not found in current showtimes");
      const cinemas = await getCinemas(env);
      const cinema = cinemas.find((c) => c.slug === s.cinemaSlug);
      const ics = showtimeToIcs(s, cinema?.address);
      const downloadUrl = `${publicBaseUrl(env)}/v1/calendar/${encodeURIComponent(sessionId)}.ics?slug=${encodeURIComponent(slug)}`;
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            downloadUrl,
            filename: `${slug}-${sessionId}.ics`,
            note: "Open or import the downloadUrl in Apple Calendar, Google Calendar, Outlook, or any calendar app. The raw ICS is included below.",
            ics,
          }, null, 2),
        }],
      };
    }
  );
}

export function registerPrivateBookingTools(server: McpServer, env: Env) {
  server.tool(
    "book_session",
    "Private tool. Reserve and book a specific seat using your Yorck Unlimited subscription. Pass cinemaSlug + sessionId + rowLabel + seatId. Will reserve, validate as Unlimited (€0), and if dryRun=false, commit. Default dryRun=true reserves only, returns preview, and does not finalize.",
    {
      sessionId: z.string().regex(/^\d{4}-\d+$/),
      cinemaSlug: z.string(),
      rowLabel: z.string().describe("e.g. '16' (the PhysicalName from seat_map)"),
      seatId: z.string().describe("e.g. '17' (the seat Id from seat_map)"),
      dryRun: z.boolean().default(true),
    },
    async ({ sessionId, cinemaSlug, rowLabel, seatId, dryRun }) => {
      const r = await reserveUnlimited(env, { sessionId, cinemaSlug, rowLabel, seatId });
      const summary = {
        reserved: true,
        approved: r.approved,
        ticketTypeCode: r.ticketTypeCode,
        orderTotal: r.order.orderTotalValueInCents / 100,
        expiresAt: r.expiresAt,
        userSessionId: r.order.userSessionId,
        cinema: cinemaSlug,
        seat: { row: rowLabel, seat: seatId },
        film: r.order.sessions[0]?.filmTitle,
        start: r.order.sessions[0]?.startTime,
      };
      if (dryRun) {
        await cancelOrder(env, r.order.userSessionId);
        return {
          content: [
            {
              type: "text" as const,
              text: `DRY-RUN ${summary.approved ? "✓" : "✗"} ${JSON.stringify(summary, null, 2)}\n(seat hold released for safety; call again with dryRun=false to actually book)`,
            },
          ],
        };
      }
      const result = await commitOrder(env, r.order.userSessionId);
      return {
        content: [
          { type: "text" as const, text: `Booked! ${JSON.stringify({ ...summary, commit: result }, null, 2)}` },
        ],
      };
    }
  );

  server.tool(
    "cancel_booking",
    "Private tool. Release a held order by userSessionId. Use this if you want to abandon a reservation before it auto-expires.",
    { userSessionId: z.string() },
    async ({ userSessionId }) => {
      await cancelOrder(env, userSessionId);
      return { content: [{ type: "text" as const, text: `cancelled ${userSessionId}` }] };
    }
  );
}
