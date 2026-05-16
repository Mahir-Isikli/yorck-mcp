import type { Env } from "../types.ts";

interface SeatPosition {
  AreaNumber: number;
  RowIndex: number;
  ColumnIndex: number;
}
interface Seat {
  Position: SeatPosition;
  Id: string;
  Status: number; // 0=available 1=sold 2=allocated 3=house 7=sofa pair anchor
  SeatStyle: number;
  SeatsInGroup?: SeatPosition[] | null;
}
interface SeatRow {
  RowIndexZeroBased: number;
  PhysicalName: string | null;
  Seats: Seat[];
}
interface SeatPlanResponse {
  SeatLayoutData: {
    Areas: Array<{
      Number: number;
      ColumnCount: number;
      RowCount: number;
      Rows: SeatRow[];
    }>;
    ScreenStart?: number;
    ScreenWidth?: number;
  };
}

export async function getSeatPlan(env: Env, cinemaVistaId: string, sessionNum: string): Promise<SeatPlanResponse> {
  const url = `${env.VISTA_BASE}/RESTData.svc/cinemas/${cinemaVistaId}/sessions/${sessionNum}/seat-plan`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://www.yorck.de",
      Referer: "https://www.yorck.de/",
      "User-Agent": "Mozilla/5.0 (yorck-mcp)",
    },
  });
  if (!res.ok) throw new Error(`seat-plan HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()) as SeatPlanResponse;
}

const STATUS_COLOR: Record<number, string> = {
  0: "#4ade80", // available - green
  1: "#52525b", // sold - dark gray
  2: "#facc15", // allocated - yellow
  3: "#27272a", // house/blocked - near-black
  4: "#7f1d1d", // broken
  5: "#a78bfa", // companion
  6: "#0ea5e9", // wheelchair
  7: "#ec4899", // sofa pair
};

export interface SvgRenderOpts {
  title?: string;
  subtitle?: string;
}

export function renderSeatPlanSvg(plan: SeatPlanResponse, opts: SvgRenderOpts = {}): string {
  const area = plan.SeatLayoutData?.Areas?.[0];
  if (!area) return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><text>No seat data</text></svg>`;

  const COL_COUNT = area.ColumnCount;
  const ROW_COUNT = Math.max(...area.Rows.map((r) => r.RowIndexZeroBased)) + 1;
  const SEAT_W = 22;
  const SEAT_H = 22;
  const SEAT_GAP = 4;
  const PAD = 60;
  const SCREEN_H = 30;
  const LABEL_W = 35;

  const W = LABEL_W + COL_COUNT * (SEAT_W + SEAT_GAP) + PAD * 2;
  const H = SCREEN_H + 30 + ROW_COUNT * (SEAT_H + SEAT_GAP) + PAD * 2;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,Menlo,monospace">`);
  out.push(`<rect width="${W}" height="${H}" fill="#0a0a0a"/>`);

  if (opts.title) {
    out.push(`<text x="${W / 2}" y="${PAD / 2 + 4}" text-anchor="middle" fill="#e5e5e5" font-size="16" font-weight="600">${escapeXml(opts.title)}</text>`);
  }
  if (opts.subtitle) {
    out.push(`<text x="${W / 2}" y="${PAD / 2 + 24}" text-anchor="middle" fill="#a3a3a3" font-size="11">${escapeXml(opts.subtitle)}</text>`);
  }

  // Screen
  const sx = plan.SeatLayoutData.ScreenStart ?? 0;
  const sw = plan.SeatLayoutData.ScreenWidth ?? COL_COUNT;
  const screenLeft = LABEL_W + PAD + sx * (SEAT_W + SEAT_GAP);
  const screenWPx = Math.max(20, sw * (SEAT_W + SEAT_GAP) - SEAT_GAP);
  const screenY = PAD;
  out.push(`<rect x="${screenLeft}" y="${screenY}" width="${screenWPx}" height="6" rx="3" fill="#fafafa"/>`);
  out.push(`<text x="${screenLeft + screenWPx / 2}" y="${screenY + 22}" text-anchor="middle" fill="#a3a3a3" font-size="11">SCREEN</text>`);

  const yStart = PAD + SCREEN_H + 30;

  for (const row of area.Rows) {
    const seats = row.Seats;
    if (!seats || !seats.length) continue;
    const name = (row.PhysicalName || "?").trim();
    const visualRow = ROW_COUNT - 1 - row.RowIndexZeroBased; // flip: row 1 just below screen
    const y = yStart + visualRow * (SEAT_H + SEAT_GAP);

    // Left label
    out.push(`<text x="${PAD + LABEL_W - 10}" y="${y + SEAT_H - 6}" text-anchor="end" fill="#a3a3a3" font-size="11">${escapeXml(name)}</text>`);

    for (const seat of seats) {
      const ci = seat.Position.ColumnIndex;
      const x = PAD + LABEL_W + ci * (SEAT_W + SEAT_GAP);
      const color = STATUS_COLOR[seat.Status] ?? "#6b7280";
      const isSofaPair = seat.Status === 7 && Array.isArray(seat.SeatsInGroup) && seat.SeatsInGroup.length > 1;
      const isSofaAnchor = isSofaPair && seat.SeatsInGroup?.[0]?.ColumnIndex === ci;
      const isSofaPartner = isSofaPair && !isSofaAnchor;
      if (isSofaPartner) continue;
      const w = isSofaAnchor ? SEAT_W * 2 + SEAT_GAP : SEAT_W;
      out.push(`<rect x="${x}" y="${y}" width="${w}" height="${SEAT_H}" rx="4" fill="${color}" data-seat-id="${escapeXml(seat.Id)}" data-row="${escapeXml(name)}" data-col="${ci}"/>`);
      if (seat.Status === 0) {
        out.push(`<text x="${x + w / 2}" y="${y + SEAT_H / 2 + 4}" text-anchor="middle" fill="#0a0a0a" font-size="9" font-weight="600">${escapeXml(seat.Id)}</text>`);
      }
    }

    // Right label
    const xR = PAD + LABEL_W + COL_COUNT * (SEAT_W + SEAT_GAP) + 6;
    out.push(`<text x="${xR}" y="${y + SEAT_H - 6}" fill="#a3a3a3" font-size="11">${escapeXml(name)}</text>`);
  }

  // Legend
  const ly = H - PAD / 2;
  let lx = PAD;
  out.push(`<text x="${lx}" y="${ly}" fill="#a3a3a3" font-size="11">Legend:</text>`);
  lx += 60;
  for (const [color, label] of [
    ["#4ade80", "available"],
    ["#52525b", "sold"],
    ["#ec4899", "sofa pair"],
    ["#27272a", "blocked"],
  ] as const) {
    out.push(`<rect x="${lx}" y="${ly - 12}" width="14" height="14" rx="3" fill="${color}"/>`);
    out.push(`<text x="${lx + 18}" y="${ly}" fill="#a3a3a3" font-size="11">${label}</text>`);
    lx += 80;
  }

  out.push("</svg>");
  return out.join("\n");
}

export function renderSeatPlanHtml(plan: SeatPlanResponse, opts: SvgRenderOpts = {}): string {
  const area = plan.SeatLayoutData?.Areas?.[0];
  const svg = renderSeatPlanSvg(plan, opts);
  const rows = area?.Rows ?? [];
  const seats = rows.flatMap((row) => row.Seats ?? []);
  const total = seats.length;
  const available = seats.filter((seat) => seat.Status === 0).length;
  const taken = seats.filter((seat) => seat.Status !== 0).length;
  const title = opts.title || "Yorck seat map";
  const subtitle = opts.subtitle || "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(title)}</title>
  <style>
    body{margin:0;background:#f7f6f2;color:#181818;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:42px 20px}
    main{max-width:1160px;margin:0 auto}.eyebrow{text-transform:uppercase;letter-spacing:.12em;color:#777;font-weight:800;font-size:13px}h1{font-size:clamp(34px,5vw,56px);letter-spacing:-.05em;margin:8px 0 8px}.sub{color:#666;margin:0 0 28px;font-size:18px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:22px 0}.stat{background:white;border:1px solid #e3dfd6;border-radius:22px;padding:18px;text-align:center}.stat b{display:block;font-size:38px;letter-spacing:-.04em}.map{background:#101010;border-radius:28px;overflow:auto;box-shadow:0 20px 70px #0002}.map svg{width:100%;height:auto;display:block}.hint{margin-top:18px;color:#666;line-height:1.5}@media(max-width:720px){.stats{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">inline HTML fallback</div>
    <h1>${escapeXml(title)}</h1>
    ${subtitle ? `<p class="sub">${escapeXml(subtitle)}</p>` : ""}
    <section class="stats"><div class="stat"><span>Total seats</span><b>${total}</b></div><div class="stat"><span>Available</span><b style="color:#166534">${available}</b></div><div class="stat"><span>Unavailable</span><b style="color:#7f1d1d">${taken}</b></div></section>
    <section class="map">${svg}</section>
    <p class="hint">Green seats are available. This view is a portable HTML fallback for clients that cannot display MCP image/SVG output directly.</p>
  </main>
</body>
</html>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Find seat by row label + seat number (the human-friendly identifiers).
export function findSeatByRowAndId(plan: SeatPlanResponse, rowLabel: string, seatId: string): Seat | undefined {
  for (const row of plan.SeatLayoutData.Areas[0]?.Rows ?? []) {
    if ((row.PhysicalName ?? "").trim() === rowLabel.trim()) {
      return row.Seats?.find((s) => s.Id === seatId);
    }
  }
  return undefined;
}
