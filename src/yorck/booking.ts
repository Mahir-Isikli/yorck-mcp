import type { Env } from "../types.ts";
import { authHeaders, whoAmI, withFreshAuthRetry } from "./auth.ts";
import { getCinemaBySlug } from "./cinemas.ts";
import { findSeatByRowAndId, getSeatPlan } from "./seats.ts";

const BASE_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Origin: "https://www.yorck.de",
  Referer: "https://www.yorck.de/",
  "User-Agent": "Mozilla/5.0 (yorck-mcp)",
};

// All Vista calls use Yorck's React-app auth chain so the gateway can read
// the embedded vistaAccessToken2 from the Cognito id-token claim.
async function vistaCall(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  const auth = await authHeaders(env);
  return fetch(env.VISTA_BASE + path, {
    ...init,
    headers: {
      ...BASE_HEADERS,
      ...auth,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

function apiBase(env: Env): string {
  return env.VISTA_BASE.replace(/\/vista\/?$/, "");
}

export interface OrderSeat {
  areaCategoryCode?: string;
  areaNumber?: number;
  rowDisplay?: string;
  columnDisplay?: string;
  rowIndex: number;
  columnIndex: number;
}

export interface OrderState {
  cinemaId: string;
  userSessionId: string;
  orderTotalValueInCents: number;
  expiryDateUtc: string;
  sessions: Array<{
    id: number;
    filmTitle: string;
    startTime: string;
    screen?: string;
    tickets: Array<{
      ticketDetails?: {
        ticketId: number;
        ticketTypeCode: string;
        description?: string;
        finalPriceInCents: number;
        originalPriceInCents: number;
      } | null;
      seats: OrderSeat[];
    }>;
  }>;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export async function createOrder(env: Env, cinemaVistaId: string): Promise<OrderState> {
  const r = await vistaCall(env, "/orders", {
    method: "POST",
    body: JSON.stringify({ cinemaId: cinemaVistaId }),
  });
  if (!r.ok) throw new Error(`createOrder ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { order: OrderState };
  return j.order;
}

export async function getOrder(env: Env, userSessionId: string): Promise<OrderState> {
  const r = await vistaCall(env, `/orders/${userSessionId}`);
  if (!r.ok) throw new Error(`getOrder ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { order: OrderState };
  return j.order;
}

export async function cancelOrder(env: Env, userSessionId: string): Promise<void> {
  await vistaCall(env, "/RESTTicketing.svc/order/cancel", {
    method: "POST",
    body: JSON.stringify({ UserSessionId: userSessionId }),
  });
}

interface RawTicket {
  TicketTypeCode: string;
  TicketCode: string;
  HOPK?: string;
  HeadOfficeGroupingCode?: string;
  AreaCategoryCode: string;
  Description?: string;
  DescriptionAlt?: string;
  LongDescription?: string;
  LongDescriptionAlt?: string;
  ThirdPartyMembershipName?: string;
  IsThirdPartyMemberTicket?: boolean;
  PriceInCents: number;
}

async function getTickets(env: Env, cinemaVistaId: string, sessionNum: string, userSessionId: string): Promise<RawTicket[]> {
  const r = await vistaCall(env, `/RESTData.svc/cinemas/${cinemaVistaId}/sessions/${sessionNum}/tickets?salesChannelFilter=WWW&userSessionId=${userSessionId}`);
  if (!r.ok) throw new Error(`tickets ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { Tickets: RawTicket[] };
  return j.Tickets ?? [];
}

async function getUnlimitedTicket(env: Env, cinemaVistaId: string, sessionNum: string, userSessionId: string): Promise<RawTicket> {
  const tickets = await getTickets(env, cinemaVistaId, sessionNum, userSessionId);
  const unlimited = tickets.find((t) => {
    const text = `${t.Description ?? ""} ${t.DescriptionAlt ?? ""} ${t.ThirdPartyMembershipName ?? ""}`.toLowerCase();
    return text.includes("unlimited") && (t.PriceInCents === 0 || t.IsThirdPartyMemberTicket);
  }) ?? tickets.find((t) => t.IsThirdPartyMemberTicket && t.PriceInCents === 0);

  if (!unlimited) {
    const available = tickets.map((t) => `${t.TicketTypeCode}:${t.DescriptionAlt ?? t.Description ?? "?"}`).join(", ");
    throw new Error(`no Yorck Unlimited ticket type for this session; available: ${available}`);
  }
  return unlimited;
}

// Step observed on yorck.de /checkout/seats: first hold the chosen seat with
// ticketDetails=null. The actual Unlimited ticket is applied after member
// validation on /checkout/tickets.
export async function holdSeat(env: Env, args: {
  userSessionId: string;
  sessionNum: string;
  seat: OrderSeat;
}): Promise<OrderState> {
  const body = {
    tickets: [
      {
        ticketDetails: null,
        seats: [args.seat],
      },
    ],
  };
  const r = await vistaCall(env, `/orders/${args.userSessionId}/sessions/${args.sessionNum}/set-tickets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`hold-seat ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { order: OrderState };
  return j.order;
}

export async function setUnlimitedTicket(env: Env, args: {
  userSessionId: string;
  sessionNum: string;
  ticketTypeCode: string;
  unlimitedCard: string;
  seat: OrderSeat;
}): Promise<OrderState> {
  const body = {
    tickets: [
      {
        ticketDetails: {
          ticketTypeCode: args.ticketTypeCode,
          thirdPartyMemberScheme: { memberCard: args.unlimitedCard },
        },
        seats: [args.seat],
      },
    ],
  };
  const r = await vistaCall(env, `/orders/${args.userSessionId}/sessions/${args.sessionNum}/set-tickets`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`set-unlimited-ticket ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { order: OrderState };
  return j.order;
}

export async function setCustomerDetails(env: Env, args: {
  userSessionId: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<void> {
  const r = await vistaCall(env, `/orders/${args.userSessionId}/customer-details`, {
    method: "POST",
    body: JSON.stringify({
      firstName: args.firstName,
      lastName: args.lastName,
      email: args.email,
    }),
  });
  if (!r.ok) throw new Error(`customer-details ${r.status}: ${await r.text()}`);
}

export async function validateMember(env: Env, args: {
  userSessionId: string;
  memberId: string;
}): Promise<unknown> {
  return withFreshAuthRetry(env, async (auth) => {
    const r = await fetch(env.VISTA_BASE + "/RESTLoyalty.svc/member/validate", {
      method: "POST",
      headers: { ...BASE_HEADERS, ...auth },
      body: JSON.stringify({
        UserSessionId: args.userSessionId,
        MemberId: args.memberId,
        ReturnMember: true,
      }),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`validate-member ${r.status}: ${text}`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  });
}

interface ValidateResponse {
  Result: number;
  ErrorDescription: string | null;
  MemberTicketApprovals: Array<{
    TicketTypeCode: string;
    MemberProviderName?: string;
    CardNumber?: string;
    ApprovedPriceInCents: number;
    ApprovedQty?: number;
  }> | null;
}

function parseValidate(text: string): ValidateResponse {
  return JSON.parse(text) as ValidateResponse;
}

function makeValidateBody(args: {
  userSessionId: string;
  cinemaVistaId: string;
  sessionId: number;
  ticketTypeCode: string;
  unlimitedCard: string;
}): string {
  return JSON.stringify({
    SessionId: args.sessionId,
    UserSessionId: args.userSessionId,
    CinemaId: args.cinemaVistaId,
    TicketTypes: [
      {
        TicketTypeCode: args.ticketTypeCode,
        Qty: 1,
        ThirdPartyMemberScheme: { MemberCard: args.unlimitedCard },
      },
    ],
  });
}

export async function validateUnlimitedMember(env: Env, args: {
  userSessionId: string;
  cinemaVistaId: string;
  sessionId: number;
  ticketTypeCode: string;
  unlimitedCard: string;
}): Promise<{
  approved: boolean;
  ticketTypeCode?: string;
  approvedPriceInCents?: number;
  raw: unknown;
}> {
  return withFreshAuthRetry(env, async (auth) => {
    const r = await fetch(env.VISTA_BASE + "/RESTTicketing.svc/order/validate/membertickets", {
      method: "POST",
      headers: { ...BASE_HEADERS, ...auth },
      body: makeValidateBody(args),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`validate-membertickets ${r.status}: ${text}`);
    const j = parseValidate(text);
    if (j.Result !== 0) throw new Error(`validate-membertickets: ${j.ErrorDescription}`);
    const first = j.MemberTicketApprovals?.[0];
    return {
      approved: !!first,
      ticketTypeCode: first?.TicketTypeCode,
      approvedPriceInCents: first?.ApprovedPriceInCents,
      raw: j as unknown,
    };
  });
}

function splitName(name: string | undefined): { firstName: string; lastName: string; fullName: string } {
  const fullName = (name || "Yorck Member").trim();
  const [firstName = "Yorck", ...rest] = fullName.split(/\s+/);
  return { firstName, lastName: rest.join(" ") || "Member", fullName };
}

async function getSessionScreen(env: Env, fullSessionId: string): Promise<string | undefined> {
  // Public Contentful delivery token embedded in yorck.de's frontend bundle.
  // confirm-order requires this `screen` value, but Vista's order response
  // does not include it for every order.
  const url = `https://cdn.contentful.com/spaces/4mws6uyas4ta/environments/master/entries?sys.id=${encodeURIComponent(fullSessionId)}&locale=en-US`;
  try {
    const r = await fetch(url, {
      headers: {
        Authorization: "Bearer UNY_7-kVS3UkYxAMEIpyO2g7Lh-8e7645oGt2ksDhE8",
        Accept: "application/json",
      },
    });
    if (!r.ok) return undefined;
    const j = await r.json() as { items?: Array<{ fields?: { screenName?: string } }> };
    return j.items?.[0]?.fields?.screenName;
  } catch {
    return undefined;
  }
}

// Full Unlimited booking pipeline up to a validated, zero-cost order.
// Caller is expected to call commitOrder() to actually finalize, or cancel().
export async function reserveUnlimited(env: Env, args: {
  cinemaSlug: string;
  sessionId: string; // full Yorck session id, e.g. "1009-5995"
  rowLabel: string; // e.g. "16"
  seatId: string; // e.g. "17"
}): Promise<{
  order: OrderState;
  approved: boolean;
  ticketTypeCode?: string;
  expiresAt: string;
}> {
  if (!env.YORCK_UNLIMITED_CARD) throw new Error("YORCK_UNLIMITED_CARD secret not set");
  if (!env.YORCK_EMAIL) throw new Error("YORCK_EMAIL secret not set");

  const cinema = await getCinemaBySlug(env, args.cinemaSlug);
  if (!cinema) throw new Error(`unknown cinema slug: ${args.cinemaSlug}`);
  const [cidPart, sessionNum] = args.sessionId.split("-");
  if (cidPart !== cinema.vistaId) {
    throw new Error(`cinema slug ${args.cinemaSlug} (vista ${cinema.vistaId}) != session prefix ${cidPart}`);
  }

  // Resolve seat coordinates.
  const plan = await getSeatPlan(env, cinema.vistaId, sessionNum);
  const seat = findSeatByRowAndId(plan, args.rowLabel, args.seatId);
  if (!seat) throw new Error(`seat Row ${args.rowLabel} Seat ${args.seatId} not found`);
  if (seat.Status !== 0) throw new Error(`seat is not available (status ${seat.Status})`);

  const orderInit = await createOrder(env, cinema.vistaId);
  const usid = orderInit.userSessionId;

  try {
    const heldOrder = await holdSeat(env, {
      userSessionId: usid,
      sessionNum,
      seat: {
        areaNumber: seat.Position.AreaNumber,
        rowIndex: seat.Position.RowIndex,
        columnIndex: seat.Position.ColumnIndex,
      },
    });

    const me = await whoAmI(env);
    if (me.memberId) {
      await validateMember(env, { userSessionId: usid, memberId: me.memberId });
    }

    const unlimited = await getUnlimitedTicket(env, cinema.vistaId, sessionNum, usid);
    const v = await validateUnlimitedMember(env, {
      userSessionId: usid,
      cinemaVistaId: cinema.vistaId,
      sessionId: parseInt(sessionNum, 10),
      ticketTypeCode: unlimited.TicketTypeCode,
      unlimitedCard: env.YORCK_UNLIMITED_CARD,
    });

    const heldSeat = heldOrder.sessions[0]?.tickets[0]?.seats[0];
    const ticketSeat: OrderSeat = {
      ...(heldSeat ?? {}),
      areaNumber: heldSeat?.areaNumber ?? seat.Position.AreaNumber,
      rowIndex: heldSeat?.rowIndex ?? seat.Position.RowIndex,
      columnIndex: heldSeat?.columnIndex ?? seat.Position.ColumnIndex,
    };

    const orderWithTicket = await setUnlimitedTicket(env, {
      userSessionId: usid,
      sessionNum,
      ticketTypeCode: unlimited.TicketTypeCode,
      unlimitedCard: env.YORCK_UNLIMITED_CARD,
      seat: ticketSeat,
    });

    const name = splitName(me.name);
    await setCustomerDetails(env, {
      userSessionId: usid,
      firstName: name.firstName,
      lastName: name.lastName,
      email: me.email || env.YORCK_EMAIL!,
    });

    const order = await getOrder(env, usid).catch(() => orderWithTicket);
    return {
      order,
      approved: v.approved,
      ticketTypeCode: v.ticketTypeCode ?? unlimited.TicketTypeCode,
      expiresAt: order.expiryDateUtc,
    };
  } catch (e) {
    // Best-effort cancel on failure.
    await cancelOrder(env, usid).catch(() => {});
    throw e;
  }
}

// Finalize the validated Unlimited order. The React app uses the payment
// confirm-order wrapper even for €0 Unlimited orders, so mirror that path.
export async function commitOrder(env: Env, userSessionId: string): Promise<unknown> {
  const me = await whoAmI(env);
  const name = splitName(me.name);
  await setCustomerDetails(env, {
    userSessionId,
    firstName: name.firstName,
    lastName: name.lastName,
    email: me.email || env.YORCK_EMAIL || "",
  });

  const order = await getOrder(env, userSessionId).catch(() => undefined);
  const session = order?.sessions?.[0];
  const fullSessionId = order?.cinemaId && session?.id ? `${order.cinemaId}-${session.id}` : undefined;
  const screen = session?.screen ?? (fullSessionId ? await getSessionScreen(env, fullSessionId) : undefined) ?? "1";

  return withFreshAuthRetry(env, async (auth) => {
    const r = await fetch(apiBase(env) + "/payment/confirm-order", {
      method: "POST",
      headers: { ...BASE_HEADERS, ...auth },
      body: JSON.stringify({
        userSessionId,
        screen,
        locale: "en",
        name: name.fullName,
        email: me.email || env.YORCK_EMAIL || "",
        ics: "",
      }),
    });
    const txt = await r.text();
    if (!r.ok) throw new Error(`confirm-order ${r.status}: ${txt}`);
    try { return JSON.parse(txt); } catch { return { raw: txt }; }
  });
}
