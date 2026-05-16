export const YORCK_MOVIE_AGENT_SKILL = `---
name: yorck-movie-agent
description: >-
  Plan movie nights with Yorck Berlin cinema. Use when the user asks for movie showtimes, seat maps, checkout links, calendar files, or booking through the yorck-mcp connector/CLI. Handles Claude Web remote MCP, Claude Code local MCP, inline HTML fallbacks, and confirmation-gated booking.
---

# Yorck Movie Agent

Use this skill when a user asks for Berlin Yorck movie planning, seat maps, direct checkout links, calendar files, or booking via the Yorck MCP/CLI.

## Available install modes

### Claude Web / Claude connectors

Remote read-only MCP endpoint:

\`\`\`txt
https://yorck-mcp.isiklimahir.workers.dev/public/mcp
\`\`\`

Use this when Claude Web, Claude Desktop connectors, Cowork, or mobile can add a custom connector. It is public and read-only: showtimes, films, cinemas, seat maps, calendar files, and checkout links. It does not book.

### Claude Code / local agents

Public/local MCP:

\`\`\`bash
claude mcp add --transport stdio yorck -- npx -y yorck-mcp mcp-stdio
\`\`\`

Private local MCP with booking credentials:

\`\`\`bash
claude mcp add --transport stdio \\
  --env YORCK_EMAIL=you@example.com \\
  --env YORCK_PASSWORD=your-password \\
  --env YORCK_UNLIMITED_CARD=your-card-number \\
  yorck -- npx -y yorck-mcp mcp-stdio
\`\`\`

### Terminal CLI

\`\`\`bash
npx -y yorck-mcp whats-on --when tonight --after 18:00
npx -y yorck-mcp plan --q "devil wears prada" --when tonight --after 18:00
npx -y yorck-mcp seat-map <session-id> --out seat-map.svg
npx -y yorck-mcp calendar <session-id> <film-slug> --out movie.ics
\`\`\`

## Tool use policy

Prefer tools in this order:

1. \`pick_showtime\`, when the user wants one good movie plan or a direct checkout link.
2. \`whats_on\`, when the user wants multiple options.
3. \`find_film\` then \`showtimes\`, when the user has a specific film title.
4. \`seat_map\`, when the environment can render or display SVG/image content.
5. \`seat_map_html\`, when SVG/image content will not display, such as some Claude Code text-only surfaces.
6. \`add_to_calendar\`, only when the user wants an ICS/calendar file.
7. \`book_session\`, only in private/local mode after explicit confirmation.

## Seat map output by environment

### If images/SVG render correctly

Use \`seat_map\`. It returns structured rows plus an SVG image.

### If SVG does not render

Use \`seat_map_html\` and show or save the inline HTML. If the client cannot open inline HTML directly, write the HTML to a local file and tell the user to open it.

In Claude Code, prefer:

\`\`\`bash
npx -y yorck-mcp seat-map-html <session-id> --out seat-map.html
open seat-map.html
\`\`\`

### If neither SVG nor HTML is possible

Use the structured rows from \`seat_map\` or \`pick_showtime\` and summarize:

- film
- cinema
- time
- format
- available row labels and available seat IDs
- direct checkout URL

Do not pretend API seat IDs are exactly the same as the visible Yorck website labels. If the user books manually, have them choose seats on Yorck's page.

## Public vs private behavior

Public mode needs no account. It can:

- search showtimes
- list cinemas
- render seat maps
- create ICS calendar files
- return direct checkout links

Private/local mode can book with credentials. It currently supports Yorck Unlimited booking. Paid checkout should be completed on Yorck's own page using the direct checkout link.

## Safety rules

- Never claim a booking was made unless \`book_session\` returned success.
- Never claim a calendar event was added unless a calendar tool actually succeeded.
- Ask for explicit confirmation before booking.
- Treat \`dryRun: true\` as the default for booking tests.
- If no Unlimited card is configured, use \`pick_showtime\` and provide the checkout link.

## Example prompts this skill should handle

- "what original-language movies are playing tonight after 7?"
- "show me a seat map for this Yorck session"
- "give me an inline HTML seat map because SVG is not rendering"
- "plan a low-stress movie night for me"
- "book the best option if my Unlimited card makes it free"
`;

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number) { return [n & 255, (n >>> 8) & 255]; }
function u32(n: number) { return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }

export function skillZip(): Uint8Array {
  const encoder = new TextEncoder();
  const filename = encoder.encode("yorck-movie-agent/SKILL.md");
  const content = encoder.encode(YORCK_MOVIE_AGENT_SKILL);
  const crc = crc32(content);
  const localHeader = new Uint8Array([
    ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(crc), ...u32(content.length), ...u32(content.length), ...u16(filename.length), ...u16(0),
  ]);
  const centralOffset = localHeader.length + filename.length + content.length;
  const centralHeader = new Uint8Array([
    ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
    ...u32(crc), ...u32(content.length), ...u32(content.length), ...u16(filename.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0),
  ]);
  const centralSize = centralHeader.length + filename.length;
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1), ...u32(centralSize), ...u32(centralOffset), ...u16(0),
  ]);
  const out = new Uint8Array(localHeader.length + filename.length + content.length + centralHeader.length + filename.length + end.length);
  let o = 0;
  for (const part of [localHeader, filename, content, centralHeader, filename, end]) { out.set(part, o); o += part.length; }
  return out;
}

export function installScript(baseUrl = "https://yorck-mcp.isiklimahir.workers.dev") {
  return `#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${baseUrl}"
DEST="\${DEST:-$HOME/.claude/skills/yorck-movie-agent}"
mkdir -p "$DEST"
curl -fsSL "$BASE_URL/skill/SKILL.md" -o "$DEST/SKILL.md"
printf 'installed yorck movie agent skill to %s\n' "$DEST"
printf 'next: add the MCP connector from %s or run: claude mcp add --transport stdio yorck -- npx -y yorck-mcp mcp-stdio\n' "$BASE_URL"
`;
}
