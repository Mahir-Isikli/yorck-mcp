import type { Showtime } from "../types.ts";

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
function escape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function showtimeToIcs(s: Showtime, address?: string): string {
  const uid = `yorck-${s.sessionId}@yorck-mcp`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//yorck-mcp//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(s.start)}`,
    `DTEND:${toIcsUtc(s.end)}`,
    `SUMMARY:${escape(s.film + " — " + s.cinema)}`,
    `LOCATION:${escape(address || s.cinema)}`,
    `URL:${s.url}`,
    `DESCRIPTION:${escape(`${s.film} (${s.format})\\nRuntime: ${s.runtime} min\\nBook: ${s.url}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
