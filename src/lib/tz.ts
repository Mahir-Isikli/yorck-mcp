// Yorck stores session times with a fixed +01:00 offset year-round (CMS bug).
// The local part of the timestamp is the actual Berlin local time. Re-anchor.

const BERLIN_TZ = "Europe/Berlin";

function berlinOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: BERLIN_TZ,
    timeZoneName: "longOffset",
  });
  const parts = fmt.formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const sign = m[1] === "+" ? 1 : -1;
  const h = parseInt(m[2], 10);
  const min = m[3] ? parseInt(m[3], 10) : 0;
  return sign * (h * 60 + min);
}

// Convert Yorck-formatted "2026-05-08T17:30:00+01:00" to a proper Berlin-local ISO string.
// We treat the local clock face as Berlin local time and apply the correct offset.
export function fixYorckTime(yorckIso: string): string {
  const m = yorckIso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return yorckIso;
  const [, y, mo, d, h, mi, s] = m;
  // Build a tentative Date in UTC representing the wall-clock time
  const tentative = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  const offsetMin = berlinOffsetMinutes(tentative);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

export function addMinutesIso(berlinIso: string, minutes: number): string {
  const d = new Date(berlinIso);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  // Re-emit in Berlin local
  const off = berlinOffsetMinutes(d);
  const local = new Date(d.getTime() + off * 60_000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const da = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  const s = String(local.getUTCSeconds()).padStart(2, "0");
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

export function nowBerlinIso(): string {
  const now = new Date();
  const off = berlinOffsetMinutes(now);
  const local = new Date(now.getTime() + off * 60_000);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, "0");
  const da = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const mi = String(local.getUTCMinutes()).padStart(2, "0");
  const s = String(local.getUTCSeconds()).padStart(2, "0");
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  return `${y}-${mo}-${da}T${h}:${mi}:${s}${sign}${oh}:${om}`;
}

export function todayBerlinDate(): string {
  return nowBerlinIso().slice(0, 10);
}
