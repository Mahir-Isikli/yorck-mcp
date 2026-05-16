import puppeteer from "@cloudflare/puppeteer";
import type { Env } from "../types.ts";

const KV_KEY = "yorck:browser-tokens";

export interface CapturedTokens {
  // Cognito chain
  idToken: string;
  accessToken: string;
  refreshToken: string;
  // Vista chain (the loyaltySessionToken header value)
  loyaltyAccessToken: string;
  loyaltyRefreshToken: string;
  // Diagnostic — exact headers the React app sends to a validate call
  // (only present if we observed one during the run).
  observedValidateHeaders?: Record<string, string>;
  observedValidateUrl?: string;
  observedValidateBody?: string;
  cookies: string;
  capturedAtMs: number;
  _diag?: {
    loyaltyHits: Array<{ store: string; key: string; value: string }>;
    localKeys: string[];
    sessionKeys: string[];
    networkSummary: string[];
    fetchLog: Array<{
      url: string;
      method: string;
      status: number | null;
      authHeaders: Record<string, string>;
      bodyPreview?: string;
      responsePreview?: string;
    }>;
    finalUrl: string;
  };
}

interface NetworkSnapshot {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  responseStatus?: number;
  responseBody?: string;
}

interface AuthResponse {
  access_token?: string;
  refresh_token?: string;
}

async function readResponseSafely(resp: Awaited<ReturnType<Awaited<ReturnType<typeof puppeteer.launch>>["newPage"]>> extends infer P ? P extends { on(...a: any[]): any } ? Parameters<P["on"]>[1] extends (r: infer R) => any ? R : never : never : never): Promise<string | undefined> {
  try {
    return await (resp as any).text();
  } catch {
    return undefined;
  }
}

export async function captureTokensViaBrowser(env: Env, opts: { force?: boolean; observeSession?: { cinemaSlug: string; sessionId: string } } = {}): Promise<CapturedTokens> {
  if (!opts.force) {
    const cached = await env.CACHE.get<CapturedTokens>(KV_KEY, "json");
    // Vista access tokens are 15 min — cache for 10.
    if (cached && Date.now() - cached.capturedAtMs < 10 * 60 * 1000) {
      return cached;
    }
  }
  if (!env.YORCK_EMAIL || !env.YORCK_PASSWORD) {
    throw new Error("YORCK_EMAIL / YORCK_PASSWORD not set");
  }

  const browser = await puppeteer.launch(env.BROWSER as any);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    );

    let loyaltyAccessToken = "";
    let loyaltyRefreshToken = "";
    let observedValidateHeaders: Record<string, string> | undefined;
    let observedValidateUrl: string | undefined;
    let observedValidateBody: string | undefined;
    const networkLog: NetworkSnapshot[] = [];

    // Capture EVERY auth-bearing request from inside the page. We patch both
    // window.fetch and XMLHttpRequest because the AWS Cognito SDK uses XHR.
    await page.evaluateOnNewDocument(`
      (() => {
        const log = (window.__yorckRequestLog = window.__yorckRequestLog || []);

        const origFetch = window.fetch;
        window.fetch = function(input, init) {
          let url = "", method = (init && init.method) || "GET", headers = {}, body = "";
          try {
            if (typeof input === "string") url = input;
            else if (input && input.url) url = input.url;
            if (init && init.headers) {
              if (init.headers instanceof Headers) {
                init.headers.forEach((v, k) => { headers[k] = v; });
              } else { Object.assign(headers, init.headers); }
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

        const OrigXHR = window.XMLHttpRequest;
        const origOpen = OrigXHR.prototype.open;
        const origSend = OrigXHR.prototype.send;
        const origSetHeader = OrigXHR.prototype.setRequestHeader;
        OrigXHR.prototype.open = function(method, url) {
          this.__entry = { kind: "xhr", t: Date.now(), url: String(url), method: String(method).toUpperCase(), headers: {}, body: "", status: null, response: null };
          log.push(this.__entry);
          return origOpen.apply(this, arguments);
        };
        OrigXHR.prototype.setRequestHeader = function(k, v) {
          if (this.__entry) this.__entry.headers[k] = v;
          return origSetHeader.apply(this, arguments);
        };
        OrigXHR.prototype.send = function(body) {
          if (this.__entry) {
            this.__entry.body = typeof body === "string" ? body : "";
            const e = this.__entry;
            this.addEventListener("loadend", () => {
              try {
                e.status = this.status;
                const txt = this.responseText || "";
                e.response = txt.length < 4000 ? txt : txt.slice(0, 4000) + "…";
              } catch (err) {}
            });
          }
          return origSend.apply(this, arguments);
        };
      })();
    `);

    page.on("request", (req: any) => {
      // Lightweight backup log via CDP for non-fetch requests.
      const url = req.url();
      if (
        url.includes("execute-api") ||
        url.includes("yorck.de") ||
        url.includes("amazonaws.com") ||
        url.includes("cognito")
      ) {
        networkLog.push({ url, method: req.method(), headers: req.headers(), postData: req.postData() });
      }
    });

    // 1. Go straight to the login page. Observed selectors on yorck.de:
    //    email = `input#email` (type=text, name=email)
    //    pass  = `input#password`
    //    submit= `button[type="submit"]`
    await page.goto("https://www.yorck.de/en/login", { waitUntil: "domcontentloaded", timeout: 30000 });

    // 2. Wait for the form to mount.
    await page.waitForSelector('input#email, input[name="email"]', { timeout: 20000 });
    await page.waitForSelector('input#password, input[name="password"]', { timeout: 20000 });
    const emailSel = (await page.$('input#email')) ? 'input#email' : 'input[name="email"]';
    const passSel = (await page.$('input#password')) ? 'input#password' : 'input[name="password"]';
    await page.type(emailSel, env.YORCK_EMAIL, { delay: 30 });
    await page.type(passSel, env.YORCK_PASSWORD, { delay: 30 });

    // 4. Submit + wait for navigation in parallel. Login is async; we don't
    //    just wait — we wait for the navigation OR a 30s timeout.
    const navPromise = page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.focus(passSel);
      await page.keyboard.press("Enter");
    }
    await navPromise;

    // 5. Give the React app time to finish any post-login background calls.
    await new Promise((r) => setTimeout(r, 4000));

    // 6. Optionally drive into a session to capture an actual validate call.
    if (opts.observeSession) {
      const url = `https://www.yorck.de/en/cinema/${opts.observeSession.cinemaSlug}/${opts.observeSession.sessionId}`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        // Give the React app time to fire the validate call when the seat
        // selector mounts.
        await new Promise((r) => setTimeout(r, 5000));
      } catch {
        // not fatal — token capture is the priority
      }
    }

    // 7. Pull Cognito + Vista tokens out of storage. We evaluate as a string
    //    so DOM-context code doesn't fail Worker-side type checking, and so
    //    `new Function` (forbidden in the Worker runtime) is not invoked.
    const evalScript = `(() => {
      const prefix = "CognitoIdentityServiceProvider." + ${JSON.stringify(env.COGNITO_CLIENT_ID)} + ".";
      const out = {
        idToken: "", accessToken: "", refreshToken: "", lastUser: "",
        // Sweep both storages for anything that smells like a Vista loyalty token.
        loyaltyHits: [],
        allLocalKeys: [],
        allSessionKeys: []
      };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        out.allLocalKeys.push(k);
        if (k.indexOf(prefix) === 0) {
          const v = localStorage.getItem(k) || "";
          if (k.endsWith(".idToken")) out.idToken = v;
          else if (k.endsWith(".accessToken")) out.accessToken = v;
          else if (k.endsWith(".refreshToken")) out.refreshToken = v;
          else if (k.endsWith(".LastAuthUser")) out.lastUser = v;
        }
        if (/loyalty|vista|access[_-]?token|session[_-]?token/i.test(k)) {
          out.loyaltyHits.push({ store: "local", key: k, value: (localStorage.getItem(k) || "").slice(0, 200) });
        }
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (!k) continue;
        out.allSessionKeys.push(k);
        if (/loyalty|vista|access[_-]?token|session[_-]?token/i.test(k)) {
          out.loyaltyHits.push({ store: "session", key: k, value: (sessionStorage.getItem(k) || "").slice(0, 200) });
        }
      }
      return out;
    })()`;
    const cognito = (await page.evaluate(evalScript as any)) as {
      idToken: string;
      accessToken: string;
      refreshToken: string;
      lastUser: string;
      loyaltyHits: Array<{ store: string; key: string; value: string }>;
      allLocalKeys: string[];
      allSessionKeys: string[];
    };
    if (cognito.loyaltyHits?.length && !loyaltyAccessToken) {
      // Try the most likely candidate.
      const hit = cognito.loyaltyHits.find((h) => /access/i.test(h.key)) ?? cognito.loyaltyHits[0];
      if (hit) loyaltyAccessToken = hit.value;
    }

    // Read in-page fetch log (this is where the React app's actual auth flow lives).
    const fetchLog = (await page.evaluate(`window.__yorckRequestLog || []` as any)) as Array<{
      t: number;
      url: string;
      method: string;
      headers: Record<string, string>;
      body: string;
      status: number | null;
      response: string | null;
    }>;
    // Mine the fetch log for tokens and validate-call signatures.
    for (const entry of fetchLog) {
      if (
        entry.url.includes("/auth/authenticate") ||
        entry.url.includes("/auth/refresh") ||
        entry.url.includes("/auth/login")
      ) {
        if (entry.response) {
          try {
            const j = JSON.parse(entry.response) as AuthResponse;
            if (j.access_token && !loyaltyAccessToken) loyaltyAccessToken = j.access_token;
            if (j.refresh_token && !loyaltyRefreshToken) loyaltyRefreshToken = j.refresh_token;
          } catch {}
        }
      }
      if (entry.url.includes("/validate/membertickets") || entry.url.includes("/order/validate")) {
        observedValidateHeaders = entry.headers;
        observedValidateUrl = entry.url;
        observedValidateBody = entry.body;
      }
      // Also: if any auth-bearing request to execute-api carries a loyaltySessionToken, grab it.
      if (entry.url.includes("execute-api") && entry.headers && !loyaltyAccessToken) {
        const lt = entry.headers["loyaltysessiontoken"] ?? entry.headers["loyaltySessionToken"];
        if (lt && lt.length > 20) loyaltyAccessToken = lt;
      }
    }

    // We don't fail when localStorage is empty — yorck.de uses HttpOnly
    // cookies, so the auth chain rides on cookies + in-memory React state.

    const cookies = await page.cookies();
    const tokens: CapturedTokens = {
      idToken: cognito.idToken,
      accessToken: cognito.accessToken,
      refreshToken: cognito.refreshToken,
      loyaltyAccessToken,
      loyaltyRefreshToken,
      observedValidateHeaders,
      observedValidateUrl,
      observedValidateBody,
      cookies: cookies.map((c: any) => `${c.name}=${c.value}`).join("; "),
      capturedAtMs: Date.now(),
      // Diagnostic — surfaced via /v1/browser-tokens
      _diag: {
        loyaltyHits: cognito.loyaltyHits ?? [],
        localKeys: cognito.allLocalKeys ?? [],
        sessionKeys: cognito.allSessionKeys ?? [],
        networkSummary: networkLog
          .map((n) => `${n.method} ${n.url.replace(/^https?:\/\/[^/]+/, "")}`)
          .slice(0, 100),
        fetchLog: fetchLog.map((e) => ({
          url: e.url,
          method: e.method,
          status: e.status,
          // Only log the headers that look auth-bearing — keep payload sane.
          authHeaders: Object.fromEntries(
            Object.entries(e.headers ?? {}).filter(([k]) =>
              /token|auth|cookie|session/i.test(k),
            ),
          ),
          bodyPreview: e.body ? e.body.slice(0, 200) : undefined,
          responsePreview: e.response ? e.response.slice(0, 200) : undefined,
        })),
        finalUrl: page.url(),
      },
    } as CapturedTokens;

    await env.CACHE.put(KV_KEY, JSON.stringify(tokens), { expirationTtl: 14 * 60 });
    return tokens;
  } finally {
    await browser.close();
  }
}

export async function browserAuthHeaders(env: Env, force = false): Promise<{
  "id-token": string;
  "access-token": string;
  loyaltySessionToken: string;
  connectapitoken: string;
  cookie?: string;
  observed?: { url?: string; headers?: Record<string, string>; body?: string };
}> {
  const t = await captureTokensViaBrowser(env, { force });
  return {
    "id-token": t.idToken,
    "access-token": t.accessToken,
    loyaltySessionToken: t.loyaltyAccessToken,
    connectapitoken: "",
    cookie: t.cookies || undefined,
    observed: {
      url: t.observedValidateUrl,
      headers: t.observedValidateHeaders,
      body: t.observedValidateBody,
    },
  };
}
