import puppeteer from "@cloudflare/puppeteer";
import type { Env } from "../types.ts";

// Drive a real browser login on yorck.de, then run our reserve+validate
// pipeline FROM INSIDE the page so the React app's fetch wrapper attaches
// whatever auth headers it normally would. Returns the raw responses so we
// can compare to what the Worker's direct-fetch path produces.
export async function runValidateInBrowser(env: Env, args: {
  sessionId: string; // "1009-5990"
  cinemaSlug: string;
  rowLabel: string;
  seatId: string;
}): Promise<unknown> {
  if (!env.YORCK_EMAIL || !env.YORCK_PASSWORD) throw new Error("YORCK_EMAIL / YORCK_PASSWORD not set");
  if (!env.YORCK_UNLIMITED_CARD) throw new Error("YORCK_UNLIMITED_CARD not set");

  const [cinemaVistaId, sessionNum] = args.sessionId.split("-");

  const browser = await puppeteer.launch(env.BROWSER as any);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    );

    // Capture all fetch + XHR for diagnostics.
    await page.evaluateOnNewDocument(`
      (() => {
        const log = (window.__yorckLog = window.__yorckLog || []);
        const origFetch = window.fetch;
        window.fetch = function(input, init) {
          let url = "", method = (init && init.method) || "GET", headers = {}, body = "";
          try {
            url = typeof input === "string" ? input : (input && input.url) || "";
            if (init && init.headers) {
              if (init.headers instanceof Headers) init.headers.forEach((v, k) => { headers[k] = v; });
              else Object.assign(headers, init.headers);
            }
            body = (init && typeof init.body === "string") ? init.body : "";
          } catch (e) {}
          const entry = { kind: "fetch", t: Date.now(), url, method, headers, body, status: null, response: null };
          log.push(entry);
          return origFetch.apply(this, arguments).then((res) => {
            entry.status = res.status;
            try {
              res.clone().text().then((txt) => {
                entry.response = txt && txt.length < 4000 ? txt : (txt || "").slice(0, 4000) + "…";
              }).catch(() => {});
            } catch (e) {}
            return res;
          });
        };
        const X = window.XMLHttpRequest;
        const oOpen = X.prototype.open, oSend = X.prototype.send, oH = X.prototype.setRequestHeader;
        X.prototype.open = function(m, u) {
          this.__e = { kind: "xhr", t: Date.now(), url: String(u), method: String(m).toUpperCase(), headers: {}, body: "", status: null, response: null };
          log.push(this.__e);
          return oOpen.apply(this, arguments);
        };
        X.prototype.setRequestHeader = function(k, v) { if (this.__e) this.__e.headers[k] = v; return oH.apply(this, arguments); };
        X.prototype.send = function(b) {
          if (this.__e) {
            this.__e.body = typeof b === "string" ? b : "";
            const e = this.__e;
            this.addEventListener("loadend", () => {
              try {
                e.status = this.status;
                const t = this.responseText || "";
                e.response = t.length < 4000 ? t : t.slice(0, 4000) + "…";
              } catch (err) {}
            });
          }
          return oSend.apply(this, arguments);
        };
      })();
    `);

    // 1. Login.
    await page.goto("https://www.yorck.de/en/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForSelector('input#email', { timeout: 20000 });
    await page.type('input#email', env.YORCK_EMAIL, { delay: 30 });
    await page.type('input#password', env.YORCK_PASSWORD, { delay: 30 });
    const navP = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    const btn = await page.$('button[type="submit"]');
    if (btn) await btn.click();
    else { await page.focus('input#password'); await page.keyboard.press("Enter"); }
    await navP;
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Navigate to the film page and try to click the session button so
    //    the React app fires its own validate-membertickets call (with all
    //    headers it normally sets via its fetch wrapper).
    await page.goto("https://www.yorck.de/en/films/rose-film", { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Find a session-time button and click it to enter the booking flow.
    const sessionTimeClicked = await page.evaluate(`(() => {
      const els = Array.from(document.querySelectorAll('button, a'));
      // Look for an element that mentions "21:30" (Rose tonight) or any
      // anchor whose href contains a session id pattern.
      for (const el of els) {
        const t = (el.textContent || "").trim();
        const href = el.getAttribute && el.getAttribute('href') || '';
        if (t.match(/^[0-9]{1,2}[:.][0-9]{2}/) || /\\d{4}-\\d+/.test(href)) {
          el.click();
          return { matched: t.slice(0, 60), href };
        }
      }
      return null;
    })()` as any);
    await new Promise((r) => setTimeout(r, 5000));
    // Stash the click result in the result for diagnostics.
    (await page.evaluate(`window.__yorckClick = ${JSON.stringify(sessionTimeClicked)}` as any));

    // 3. From inside the page, run our reserve+validate sequence using
    //    window.fetch (which the React app's setup may have wrapped).
    const script = `(async () => {
      const VISTA = "https://uq8lgoj7z2.execute-api.eu-central-1.amazonaws.com/production/api/vista";
      const out = { steps: [] };
      const J = (x) => JSON.stringify(x);
      const post = async (path, body) => {
        const r = await fetch(VISTA + path, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: J(body) });
        const txt = await r.text();
        return { status: r.status, body: txt.length < 3000 ? txt : txt.slice(0, 3000) + "…" };
      };
      const get = async (path) => {
        const r = await fetch(VISTA + path);
        const txt = await r.text();
        return { status: r.status, body: txt.length < 3000 ? txt : txt.slice(0, 3000) + "…" };
      };

      try {
        // 3a. Create order
        const o = await post("/orders", { cinemaId: ${JSON.stringify(cinemaVistaId)} });
        out.steps.push({ step: "createOrder", ...o });
        const orderJson = JSON.parse(o.body);
        const usid = orderJson.order.userSessionId;
        out.userSessionId = usid;

        // 3b. Get tickets list
        const t = await get("/RESTData.svc/cinemas/" + ${JSON.stringify(cinemaVistaId)} + "/sessions/" + ${JSON.stringify(sessionNum)} + "/tickets?salesChannelFilter=WWW&userSessionId=" + usid);
        out.steps.push({ step: "tickets", ...t });
        const tj = JSON.parse(t.body);
        const std = tj.Tickets.find(x => x.Description === "Normal (Online)") || tj.Tickets[0];
        out.standardTicket = std;

        // 3c. Resolve seat
        const sp = await get("/RESTData.svc/cinemas/" + ${JSON.stringify(cinemaVistaId)} + "/sessions/" + ${JSON.stringify(sessionNum)} + "/seat-plan");
        out.steps.push({ step: "seatPlan", status: sp.status, sample: sp.body.slice(0, 200) });
        const spJ = JSON.parse(sp.body);
        const row = spJ.SeatLayoutData.Areas[0].Rows.find(r => (r.PhysicalName || "").trim() === ${JSON.stringify(args.rowLabel)}.trim());
        if (!row) { out.error = "row not found"; return out; }
        const seat = row.Seats.find(s => s.Id === ${JSON.stringify(args.seatId)});
        if (!seat) { out.error = "seat not found"; return out; }
        out.seat = { Position: seat.Position, Status: seat.Status };

        // 3d. Set standard ticket
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
          }]
        };
        const st = await post("/orders/" + usid + "/sessions/" + ${JSON.stringify(sessionNum)} + "/set-tickets", setBody);
        out.steps.push({ step: "setTickets", ...st });

        // 3e. Validate Unlimited
        const validateBody = {
          UserSessionId: usid,
          CinemaId: ${JSON.stringify(cinemaVistaId)},
          SessionId: ${parseInt(sessionNum, 10)},
          TicketTypes: [{
            TicketTypeCode: "0183",
            Qty: 1,
            ThirdPartyMemberScheme: { MemberCard: ${JSON.stringify(env.YORCK_UNLIMITED_CARD)} }
          }]
        };
        out.validateBody = validateBody;
        const v = await post("/RESTTicketing.svc/order/validate/membertickets", validateBody);
        out.steps.push({ step: "validateMemberTickets", ...v });

        // 3f. Cancel cleanup
        try {
          const c = await post("/RESTTicketing.svc/order/cancel", { UserSessionId: usid });
          out.steps.push({ step: "cancel", ...c });
        } catch (e) { out.cancelErr = String(e); }
      } catch (e) {
        out.error = String(e);
      }
      return out;
    })()`;
    const result = await page.evaluate(script as any);

    // Pull the captured network log so we can see headers actually sent.
    const log = (await page.evaluate(`window.__yorckLog || []` as any)) as Array<any>;
    const apiLog = log
      .filter((e) => /execute-api|amazonaws|yorck/.test(e.url))
      .map((e) => ({
        url: e.url,
        method: e.method,
        status: e.status,
        // Filter to auth-bearing headers only
        headers: Object.fromEntries(Object.entries(e.headers || {}).filter(([k]) => /token|auth|cookie|session/i.test(k)).map(([k, v]) => [k, typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v])),
        bodyPreview: e.body ? e.body.slice(0, 300) : undefined,
        responsePreview: e.response ? e.response.slice(0, 300) : undefined,
      }));

    const finalUrl = page.url();
    const clickResult = await page.evaluate(`window.__yorckClick || null` as any);
    return { ok: true, result, apiLog, finalUrl, clickResult };
  } finally {
    await browser.close();
  }
}
