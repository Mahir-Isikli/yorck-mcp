import { Hono } from "hono";
import type { Env } from "./types.ts";
import { searchShowtimes, findFilmsByQuery, getComingSoon } from "./yorck/films.ts";
import { getCinemas, getCinemaBySlug } from "./yorck/cinemas.ts";
import { getSeatPlan, renderSeatPlanHtml, renderSeatPlanSvg } from "./yorck/seats.ts";
import { reserveUnlimited, cancelOrder, getOrder } from "./yorck/booking.ts";
import { whoAmI } from "./yorck/auth.ts";
import { showtimeToIcs } from "./lib/ics.ts";
import { PublicYorckMcp, YorckMcp } from "./mcp.ts";
import { CLAUDE_CODE_BOOTSTRAP_PROMPT, installScript, skillZip, YORCK_MOVIE_AGENT_SKILL } from "./skill-content.ts";
import { landingPage } from "./landing.ts";

export { PublicYorckMcp, YorckMcp };

const app = new Hono<{ Bindings: Env }>();

function isAuthorized(req: Request, env: Env): boolean {
  const expected = env.YORCK_MCP_AUTH_TOKEN;
  if (!expected) return true;

  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const explicit = req.headers.get("x-yorck-mcp-token") || undefined;
  return bearer === expected || explicit === expected;
}

function unauthorizedResponse(): Response {
  return new Response("unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}

function requireAuth(c: { req: { raw: Request }; env: Env; text: (body: string, status?: number, headers?: Record<string, string>) => Response }) {
  if (isAuthorized(c.req.raw, c.env)) return null;
  return c.text("unauthorized", 401, { "WWW-Authenticate": "Bearer" });
}

app.get("/", (c) => c.html(landingPage()));

app.get("/skill/SKILL.md", (c) => c.text(YORCK_MOVIE_AGENT_SKILL, 200, { "Content-Type": "text/markdown; charset=utf-8" }));

app.get("/install.sh", (c) => c.text(installScript("https://yorck-mcp.isiklimahir.workers.dev"), 200, { "Content-Type": "text/x-shellscript; charset=utf-8" }));

app.get("/claude-code-prompt.md", (c) => c.text(CLAUDE_CODE_BOOTSTRAP_PROMPT, 200, { "Content-Type": "text/markdown; charset=utf-8" }));

app.get("/skill.zip", () => {
  const zip = skillZip();
  const body = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=yorck-movie-agent-skill.zip",
    },
  });
});

// REST endpoints (also handy for quick curl tests)
app.get("/v1/films", async (c) => {
  const q = c.req.query();
  const showtimes = await searchShowtimes(c.env, {
    when: q.when as string | undefined,
    date: q.date,
    cinemas: q.cinemas?.split(","),
    formats: q.formats?.split(","),
    preferEnglish: q.preferEnglish === "true",
    genres: q.genres?.split(","),
    fskMax: q.fskMax ? parseInt(q.fskMax, 10) : undefined,
    runtimeMax: q.runtimeMax ? parseInt(q.runtimeMax, 10) : undefined,
    after: q.after,
    before: q.before,
    yorckPick: q.yorckPick === "true",
    district: q.district?.split(","),
    query: q.q,
  });
  return c.json({ count: showtimes.length, showtimes: showtimes.slice(0, 100) });
});

app.get("/v1/films/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.text("missing ?q=", 400);
  const matches = await findFilmsByQuery(c.env, q, parseInt(c.req.query("limit") ?? "5", 10));
  return c.json(matches);
});

app.get("/v1/coming-soon", async (c) => c.json(await getComingSoon(c.env)));

app.get("/v1/cinemas", async (c) => c.json(await getCinemas(c.env)));
app.get("/v1/cinemas/:slug", async (c) => {
  const cinema = await getCinemaBySlug(c.env, c.req.param("slug"));
  if (!cinema) return c.text("not found", 404);
  return c.json(cinema);
});

// Seat plan as raw JSON (for diagnostics — see PhysicalName values)
app.get("/v1/seat-plan/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const [cinemaVistaId, sessionNum] = sessionId.split("-");
  if (!cinemaVistaId || !sessionNum) return c.text("bad sessionId", 400);
  const plan = await getSeatPlan(c.env, cinemaVistaId, sessionNum);
  // Project to a small, readable shape.
  const rows = (plan.SeatLayoutData.Areas[0]?.Rows ?? []).map((r) => ({
    physicalName: r.PhysicalName,
    rowIndex: r.RowIndexZeroBased,
    availableIds: (r.Seats ?? []).filter((s) => s.Status === 0).map((s) => s.Id),
  }));
  return c.json({ rows });
});

// Seat plan as SVG (renders directly in browser)
app.get("/v1/seat-map/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const [cinemaVistaId, sessionNum] = sessionId.split("-");
  if (!cinemaVistaId || !sessionNum) return c.text("bad sessionId", 400);
  const cinemas = await getCinemas(c.env);
  const cinema = cinemas.find((x) => x.vistaId === cinemaVistaId);
  if (!cinema) return c.text("unknown cinema", 404);
  const plan = await getSeatPlan(c.env, cinemaVistaId, sessionNum);
  const svg = renderSeatPlanSvg(plan, {
    title: cinema.name,
    subtitle: `Session ${sessionId}`,
  });
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
});

app.get("/v1/seat-map-html/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");
  const [cinemaVistaId, sessionNum] = sessionId.split("-");
  if (!cinemaVistaId || !sessionNum) return c.text("bad sessionId", 400);
  const cinemas = await getCinemas(c.env);
  const cinema = cinemas.find((x) => x.vistaId === cinemaVistaId);
  if (!cinema) return c.text("unknown cinema", 404);
  const plan = await getSeatPlan(c.env, cinemaVistaId, sessionNum);
  const html = renderSeatPlanHtml(plan, {
    title: cinema.name,
    subtitle: `Session ${sessionId}`,
  });
  return c.html(html);
});

// Public downloadable calendar file. This makes the read-only MCP useful even
// for clients that cannot write files themselves: the agent can hand the user a
// normal .ics URL that Apple Calendar, Google Calendar, and Outlook can import.
app.get("/v1/calendar/:filename", async (c) => {
  const sessionId = c.req.param("filename").replace(/\.ics$/i, "");
  const slug = c.req.query("slug");
  const all = await searchShowtimes(c.env, { cinemas: undefined, formats: ["OmeU", "OV", "OmU", "DF"] });
  const showtime = all.find((x) => x.sessionId === sessionId && (!slug || x.slug === slug));
  if (!showtime) return c.text("session not found", 404);
  const cinemas = await getCinemas(c.env);
  const cinema = cinemas.find((x) => x.slug === showtime.cinemaSlug);
  const ics = showtimeToIcs(showtime, cinema?.address);
  const filename = `${showtime.slug}-${sessionId}.ics`.replace(/[^a-z0-9._-]+/gi, "-");
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
});

// Step-by-step diagnostic — runs each booking call separately so we can see
// which one actually fails. Returns the response of every step.
app.post("/v1/book/debug", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const body = await c.req.json<{ sessionId: string; cinemaSlug: string; rowLabel: string; seatId: string }>();
  const out: Array<{ step: string; ok: boolean; data?: unknown; error?: string }> = [];
  try {
    const { authHeaders } = await import("./yorck/auth.ts");
    const { getCinemaBySlug } = await import("./yorck/cinemas.ts");
    const { getSeatPlan, findSeatByRowAndId } = await import("./yorck/seats.ts");
    const auth = await authHeaders(c.env);

    const cinema = await getCinemaBySlug(c.env, body.cinemaSlug);
    if (!cinema) return c.json({ ok: false, error: "unknown cinema" }, 400);
    const [, sessionNum] = body.sessionId.split("-");

    const baseHeaders = {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.yorck.de",
      Referer: "https://www.yorck.de/",
      "User-Agent": "Mozilla/5.0 (yorck-mcp)",
      ...auth,
    };

    const VISTA = c.env.VISTA_BASE;

    // 1. Create order
    const r1 = await fetch(VISTA + "/orders", { method: "POST", headers: baseHeaders, body: JSON.stringify({ cinemaId: cinema.vistaId }) });
    const t1 = await r1.text();
    out.push({ step: "createOrder", ok: r1.ok, data: { status: r1.status, body: t1.slice(0, 500) } });
    if (!r1.ok) return c.json({ ok: false, steps: out }, 500);
    const usid = JSON.parse(t1).order.userSessionId;

    // 2. Get tickets list
    const r2 = await fetch(VISTA + `/RESTData.svc/cinemas/${cinema.vistaId}/sessions/${sessionNum}/tickets?salesChannelFilter=WWW&userSessionId=${usid}`, { headers: baseHeaders });
    const t2 = await r2.text();
    out.push({ step: "tickets", ok: r2.ok, data: { status: r2.status, body: t2.slice(0, 500) } });
    if (!r2.ok) return c.json({ ok: false, userSessionId: usid, steps: out }, 500);

    // 3. Resolve seat
    const plan = await getSeatPlan(c.env, cinema.vistaId, sessionNum);
    const seat = findSeatByRowAndId(plan, body.rowLabel, body.seatId);
    if (!seat) {
      out.push({ step: "seat", ok: false, error: "seat not found" });
      return c.json({ ok: false, steps: out }, 400);
    }

    // 4. Set tickets
    const tickets = JSON.parse(t2).Tickets as any[];
    const std = tickets.find((t) => t.Description === "Normal (Online)") ?? tickets[0];
    const setBody = {
      tickets: [{
        ticketDetails: {
          ticketTypeCode: std.TicketTypeCode,
          ticketCode: std.TicketCode,
          areaCategoryCode: std.AreaCategoryCode,
          headOfficeGroupingCode: std.HeadOfficeGroupingCode,
          priceInCents: std.PriceInCents,
        },
        seats: [{ areaNumber: seat.Position.AreaNumber, rowIndex: seat.Position.RowIndex, columnIndex: seat.Position.ColumnIndex }],
      }],
    };
    const r3 = await fetch(VISTA + `/orders/${usid}/sessions/${sessionNum}/set-tickets`, { method: "POST", headers: baseHeaders, body: JSON.stringify(setBody) });
    const t3 = await r3.text();
    out.push({ step: "setTickets", ok: r3.ok, data: { status: r3.status, body: t3.slice(0, 500) } });

    // 4.5a. Set customer details (the React app does this before validate).
    const { whoAmI } = await import("./yorck/auth.ts");
    const me = await whoAmI(c.env);
    const [first = "Yorck", ...rest] = (me.name || "Member").split(" ");
    const cdBody = { firstName: first, lastName: rest.join(" ") || "Member", email: me.email };
    const r34 = await fetch(VISTA + `/orders/${usid}/customer-details`, { method: "POST", headers: baseHeaders, body: JSON.stringify(cdBody) });
    const t34 = await r34.text();
    out.push({ step: "customerDetails", ok: r34.ok, data: { status: r34.status, body: t34.slice(0, 300) } });

    // 4.5b. Validate the member to get a LoyaltySessionToken.
    const memberBody = {
      UserSessionId: me.memberId + Date.now(),
      MemberId: me.memberId,
      ReturnMember: true,
    };
    const r35 = await fetch(VISTA + "/RESTLoyalty.svc/member/validate", { method: "POST", headers: baseHeaders, body: JSON.stringify(memberBody) });
    const t35 = await r35.text();
    out.push({ step: "validateMember", ok: r35.ok, data: { status: r35.status, body: t35.slice(0, 4000), reqBody: memberBody } });

    // 4.6. Pull the LoyaltySessionToken out of the validateMember response.
    let loyaltySessionToken: string | undefined;
    try {
      const memberJson = JSON.parse(t35);
      loyaltySessionToken = memberJson.LoyaltySessionToken;
    } catch {}

    // 5. Validate (try several variations, with and without the loyaltySessionToken header).
    // Pull the embedded vistaAccessToken2 from the id-token claim — this is
    // what the gateway used to validate against, the original "loyaltySessionToken".
    const { decodeJwt } = await import("./lib/jwt.ts");
    const idClaims = decodeJwt<{ "custom:vistaAccessToken2"?: string }>(auth["id-token"]);
    const embeddedVistaToken = idClaims["custom:vistaAccessToken2"] ?? "";

    const lst = loyaltySessionToken ?? "";
    const variants: Array<{ name: string; body: any; extraHeaders?: Record<string, string> }> = [
      { name: "card-no-extra", body: { UserSessionId: usid, CinemaId: cinema.vistaId, SessionId: parseInt(sessionNum, 10), TicketTypes: [{ TicketTypeCode: "0183", Qty: 1, ThirdPartyMemberScheme: { MemberCard: c.env.YORCK_UNLIMITED_CARD } }] } },
      { name: "embedded-as-lst-header", body: { UserSessionId: usid, CinemaId: cinema.vistaId, SessionId: parseInt(sessionNum, 10), TicketTypes: [{ TicketTypeCode: "0183", Qty: 1, ThirdPartyMemberScheme: { MemberCard: c.env.YORCK_UNLIMITED_CARD } }] }, extraHeaders: { loyaltySessionToken: embeddedVistaToken } },
      { name: "embedded-and-validatemember-lst", body: { UserSessionId: usid, CinemaId: cinema.vistaId, SessionId: parseInt(sessionNum, 10), TicketTypes: [{ TicketTypeCode: "0183", Qty: 1, ThirdPartyMemberScheme: { MemberCard: c.env.YORCK_UNLIMITED_CARD } }] }, extraHeaders: { loyaltySessionToken: embeddedVistaToken, "x-loyalty-session-token": lst } },
      { name: "no-loyaltytoken-but-with-uppercase-membercardnumber", body: { UserSessionId: usid, CinemaId: cinema.vistaId, SessionId: parseInt(sessionNum, 10), TicketTypes: [{ TicketTypeCode: "0183", Qty: 1, ThirdPartyMemberScheme: { MemberCardNumber: c.env.YORCK_UNLIMITED_CARD } }] } },
    ];
    for (const variant of variants) {
      const headers: Record<string, string> = { ...baseHeaders, ...(variant.extraHeaders || {}) };
      const r = await fetch(VISTA + "/RESTTicketing.svc/order/validate/membertickets", { method: "POST", headers, body: JSON.stringify(variant.body) });
      const t = await r.text();
      out.push({ step: `validate:${variant.name}`, ok: r.ok, data: { status: r.status, body: t.slice(0, 800) } });
      if (r.ok && t.includes("\"Result\":0")) break;
    }

    // Also try alternative endpoints — Vista sometimes does the Unlimited swap
    // via concessions / loyalty-redemption / set-member-ticket.
    for (const altPath of [
      "/RESTTicketing.svc/order/concessions",
      "/RESTTicketing.svc/order/loyalty-redemption",
      `/orders/${usid}/sessions/${sessionNum}/set-member-tickets`,
      `/orders/${usid}/sessions/${sessionNum}/redeem-member-ticket`,
    ]) {
      const r = await fetch(VISTA + altPath, { method: "POST", headers: baseHeaders, body: JSON.stringify({ UserSessionId: usid, MemberCard: c.env.YORCK_UNLIMITED_CARD, TicketTypeCode: "0183" }) });
      const t = await r.text();
      out.push({ step: `alt:${altPath}`, ok: r.ok, data: { status: r.status, body: t.slice(0, 400) } });
    }

    // 6. Cancel
    const r5 = await fetch(VISTA + "/RESTTicketing.svc/order/cancel", { method: "POST", headers: baseHeaders, body: JSON.stringify({ UserSessionId: usid }) });
    const t5 = await r5.text();
    out.push({ step: "cancel", ok: r5.ok, data: { status: r5.status, body: t5.slice(0, 300) } });

    return c.json({ ok: true, userSessionId: usid, steps: out, authHeadersUsed: Object.keys(auth) });
  } catch (e) {
    return c.json({ ok: false, error: String(e), steps: out }, 500);
  }
});

// Booking endpoints (POST so they're not idempotent-by-accident)
app.post("/v1/book/preview", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const body = await c.req.json<{ sessionId: string; cinemaSlug: string; rowLabel: string; seatId: string }>();
  try {
    const r = await reserveUnlimited(c.env, body);
    // Preview = release seat immediately
    await cancelOrder(c.env, r.order.userSessionId);
    return c.json({
      approved: r.approved,
      ticketTypeCode: r.ticketTypeCode,
      orderTotal: r.order.orderTotalValueInCents / 100,
      expiresAt: r.expiresAt,
      seat: { row: body.rowLabel, seat: body.seatId },
      note: "preview only, hold released",
    });
  } catch (e) {
    return c.json({ ok: false, error: String(e), stack: (e as Error).stack?.split("\n").slice(0, 5) }, 500);
  }
});

app.post("/v1/book/commit", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const body = await c.req.json<{ sessionId: string; cinemaSlug: string; rowLabel: string; seatId: string }>();
  const r = await reserveUnlimited(c.env, body);
  if (!r.approved) {
    await cancelOrder(c.env, r.order.userSessionId);
    return c.json({ ok: false, error: "Unlimited validation did not approve" }, 400);
  }
  const { commitOrder } = await import("./yorck/booking.ts");
  const result = await commitOrder(c.env, r.order.userSessionId);
  return c.json({
    ok: true,
    orderTotal: r.order.orderTotalValueInCents / 100,
    seat: { row: body.rowLabel, seat: body.seatId },
    cinema: body.cinemaSlug,
    sessionId: body.sessionId,
    commit: result,
  });
});

app.get("/v1/me", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  try {
    return c.json(await whoAmI(c.env));
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// Diagnostic — log into yorck.de in a real browser and, while logged in,
// fire validate-membertickets from inside the page context (so the React
// app's auth interceptor adds whatever it adds). Returns the response
// verbatim so we can see what's actually expected.
app.get("/v1/browser-validate", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  try {
    const sessionId = c.req.query("sessionId") || "1009-5990";
    const cinemaSlug = c.req.query("cinemaSlug") || "kino-international";
    const rowLabel = c.req.query("rowLabel") || "16";
    const seatId = c.req.query("seatId") || "30";
    const { runValidateInBrowser } = await import("./yorck/browserBook.ts");
    const r = await runValidateInBrowser(c.env, { sessionId, cinemaSlug, rowLabel, seatId });
    return c.json(r);
  } catch (e) {
    return c.json({ ok: false, error: String(e), stack: (e as Error).stack?.split("\n").slice(0, 10) }, 500);
  }
});

// Diagnostic — drives a real browser login on yorck.de and returns what tokens
// + (if observed) what validate-call headers the React app actually sends.
// Useful for comparing against our direct-fetch path.
app.get("/v1/browser-tokens", async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  try {
    const { captureTokensViaBrowser } = await import("./yorck/browserAuth.ts");
    const t = await captureTokensViaBrowser(c.env, { force: c.req.query("force") === "true" });
    return c.json({
      ok: true,
      idTokenHead: t.idToken.slice(0, 32) + "…",
      loyaltyAccessTokenHead: t.loyaltyAccessToken ? t.loyaltyAccessToken.slice(0, 32) + "…" : null,
      observedValidateUrl: t.observedValidateUrl,
      observedValidateHeaders: t.observedValidateHeaders,
      observedValidateBody: t.observedValidateBody,
      cookieCount: (t.cookies.match(/=/g) ?? []).length,
      capturedAtMs: t.capturedAtMs,
      diag: t._diag,
    });
  } catch (e) {
    return c.json({ ok: false, error: String(e), stack: (e as Error).stack?.split("\n").slice(0, 8) }, 500);
  }
});

// Delegate MCP routes before falling through to Hono routes.
const publicCors = {
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  headers: "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version",
  exposeHeaders: "Mcp-Session-Id",
};
const publicMcpStreamable = PublicYorckMcp.serve("/public/mcp", { binding: "PUBLIC_MCP_OBJECT", corsOptions: publicCors });
const publicMcpSse = PublicYorckMcp.serveSSE("/public/sse", { binding: "PUBLIC_MCP_OBJECT", corsOptions: publicCors });
const mcpStreamable = YorckMcp.serve("/mcp");
const mcpSse = YorckMcp.serveSSE("/sse");

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/public/mcp" || url.pathname.startsWith("/public/mcp/")) {
      return publicMcpStreamable.fetch(req, env, ctx);
    }
    if (url.pathname === "/public/sse" || url.pathname.startsWith("/public/sse/")) {
      return publicMcpSse.fetch(req, env, ctx);
    }
    if (url.pathname === "/mcp" || url.pathname.startsWith("/mcp/")) {
      if (!isAuthorized(req, env)) return unauthorizedResponse();
      return mcpStreamable.fetch(req, env, ctx);
    }
    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      if (!isAuthorized(req, env)) return unauthorizedResponse();
      return mcpSse.fetch(req, env, ctx);
    }
    return app.fetch(req, env, ctx);
  },
};
