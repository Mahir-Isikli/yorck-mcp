# yorck-mcp

CLI and MCP tools for Yorck Berlin cinema.

- Public search, film lookup, cinemas, seat maps, and ICS calendar files need no account.
- Manual planning is usable without Yorck Unlimited. It returns showtimes, seat maps, calendar files, and a checkout link.
- Automated booking is local and opt-in. Today it needs your own Yorck account email, password, and Yorck Unlimited card number.
- Real automated booking is never the default. Dry run validates Unlimited pricing and releases the seat hold.

## CLI

```bash
npx yorck-mcp whats-on --when tonight --after 18:00 --cinemas passage,rollberg
npx yorck-mcp search "devil wears prada"
npx yorck-mcp seat-map 1007-30456 --out seat-map.svg
npx yorck-mcp seat-map-html 1007-30456 --out seat-map.html
npx yorck-mcp calendar 1007-30456 the-devil-wears-prada-2 --out movie.ics
```

Plan a manual booking, no account needed:

```bash
npx yorck-mcp plan --q "devil wears prada" --when tonight --after 18:00
```

This returns a checkout seat-selection link, for example `https://www.yorck.de/en/checkout/seats?sessionid=...`, plus the matching film, cinema, time, and a seat-plan summary. The manual flow lets the user choose seats on Yorck's page.

## Booking

Dry run:

```bash
YORCK_EMAIL="you@example.com" \
YORCK_PASSWORD="..." \
YORCK_UNLIMITED_CARD="..." \
npx yorck-mcp book-best --q "devil wears prada" --when tonight --after 18:00
```

Real booking requires `--commit --yes`:

```bash
YORCK_EMAIL="you@example.com" \
YORCK_PASSWORD="..." \
YORCK_UNLIMITED_CARD="..." \
npx yorck-mcp book-best --q "devil wears prada" --when tonight --after 18:00 --commit --yes
```

You do not need to provide a separate member ID. The Yorck login response includes it when the account has one, and the booking flow uses it internally.

## Skill install

Install a Claude Code skill that teaches the agent which Yorck tool to use in each environment:

```bash
npx yorck-mcp install-skill --target claude
```

Or from the hosted page:

```bash
curl -fsSL https://yorck-mcp.isiklimahir.workers.dev/install.sh | bash
```

The skill includes guidance for Claude Web remote connectors, Claude Code local MCP, inline HTML seat-map fallback, and confirmation-gated booking.

## MCP

Read-only remote MCP:

```bash
npx yorck-mcp mcp-config
```

Bookable local stdio MCP:

```bash
npx yorck-mcp mcp-config --private
```

Equivalent config:

```json
{
  "mcpServers": {
    "yorck": {
      "command": "npx",
      "args": ["-y", "yorck-mcp", "mcp-stdio"],
      "env": {
        "YORCK_EMAIL": "you@example.com",
        "YORCK_PASSWORD": "...",
        "YORCK_UNLIMITED_CARD": "..."
      }
    }
  }
}
```

Hosted public MCP endpoint:

```txt
https://yorck-mcp.isiklimahir.workers.dev/public/mcp
```
