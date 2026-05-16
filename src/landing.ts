import { CLAUDE_CODE_BOOTSTRAP_PROMPT, YORCK_MOVIE_AGENT_SKILL } from "./skill-content.ts";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function heroSeats(): string {
  const taken = new Set([7, 8, 28, 43, 44, 45, 66, 67, 85, 99]);
  const selected = new Set([56, 57]);
  const blocked = new Set([12, 13, 14, 76]);
  return Array.from({ length: 108 }, (_, i) => {
    const cls = selected.has(i) ? "seat selected" : taken.has(i) ? "seat taken" : blocked.has(i) ? "seat blocked" : "seat";
    return `<span class="${cls}" aria-hidden="true"></span>`;
  }).join("");
}

export function landingPage(): string {
  const claudePrompt = escapeHtml(CLAUDE_CODE_BOOTSTRAP_PROMPT.trim());
  const skillMarkdown = escapeHtml(YORCK_MOVIE_AGENT_SKILL.trim());
  const curlPrompt = "curl -fsSL https://yorck-mcp.isiklimahir.workers.dev/claude-code-prompt.md";
  const claudeWeb = "https://yorck-mcp.isiklimahir.workers.dev/public/mcp";
  const skillZip = "https://yorck-mcp.isiklimahir.workers.dev/skill.zip";
  const localSkill = "npx -y yorck-mcp install-skill --target claude";
  const claudePublic = "claude mcp add --transport http yorck https://yorck-mcp.isiklimahir.workers.dev/public/mcp";
  const privateMcp = `claude mcp add --transport stdio \\
  --env YORCK_EMAIL=you@example.com \\
  --env YORCK_PASSWORD=your-password \\
  --env YORCK_UNLIMITED_CARD=your-card-number \\
  yorck-private -- npx -y yorck-mcp mcp-stdio`;
  const cliQuickstart = `npx -y yorck-mcp plan --q "devil wears prada" --when tonight --after 18:00
npx -y yorck-mcp seat-map-html <session-id> --out seat-map.html
open seat-map.html`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Yorck Movie Agent</title>
  <meta name="description" content="Install a Yorck Berlin cinema MCP, CLI, and Claude skill for movie planning, seat maps, checkout links, and local private booking." />
  <meta property="og:title" content="Yorck Movie Agent" />
  <meta property="og:description" content="A public MCP connector plus local CLI skill for Yorck movie nights." />
  <style>
    @font-face{font-family:GT-Alpina;src:url(https://www.yorck.de/fonts/GT-Alpina-Standard-Light.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:Messina-Sans;src:url(https://www.yorck.de/fonts/MessinaSansWeb-Regular.woff2) format("woff2");font-weight:400;font-style:normal;font-display:swap}
    @font-face{font-family:Messina-Sans;src:url(https://www.yorck.de/fonts/MessinaSansWeb-Bold.woff2) format("woff2");font-weight:700;font-style:normal;font-display:swap}
    :root{--yellow:#fcef17;--ink:#1a1a1a;--muted:#606060;--line:#1a1a1a;--soft:#f6f6f6;--paper:#fff;--purple:#824cff;--green:#248a45;--red:#d14b45;--cream:#fbfaf4}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fff;color:var(--ink);font-family:Messina-Sans,Roboto,Helvetica,Arial,sans-serif;letter-spacing:-.015em}a{color:inherit}.page{width:min(1440px,calc(100% - 48px));margin:0 auto}.topbar{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.94);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}.nav{height:78px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:13px;text-decoration:none;font-weight:700;letter-spacing:-.035em}.mark{width:48px;height:48px;display:grid;place-items:center}.mark svg{display:block;width:48px;height:48px}.brand-text{line-height:.9;font-size:18px}.nav-links{display:flex;align-items:center;gap:30px;font-size:18px;font-weight:700}.nav-links a{text-decoration:none}.nav-links a:hover{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:5px}.nav-pill{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 21px;border-radius:999px;background:var(--yellow);font-size:15px;text-transform:uppercase;letter-spacing:.02em}.nav-pill:hover{text-decoration:none!important;filter:brightness(.96)}.hero{display:grid;grid-template-columns:minmax(360px,.82fr) minmax(540px,1fr);min-height:calc(100vh - 78px);border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}.hero-left{display:grid;grid-template-rows:1fr auto;border-right:1px solid var(--line);min-width:0}.hook{padding:56px clamp(24px,4vw,66px) 42px}.eyebrow{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;font-size:14px;text-transform:uppercase;letter-spacing:.12em;font-weight:700}.eyebrow:before{content:"";width:12px;height:12px;border-radius:50%;background:var(--yellow);box-shadow:0 0 0 1px var(--ink)}h1{margin:0 0 26px;font-size:clamp(54px,6.2vw,98px);line-height:.88;letter-spacing:-.076em;max-width:760px}.alpina{font-family:GT-Alpina,Georgia,serif;font-weight:400;letter-spacing:-.055em}.lead{max-width:650px;margin:0;color:#2b2b2b;font-size:clamp(20px,2.2vw,31px);line-height:1.14;letter-spacing:-.045em}.lead strong{font-weight:700}.quick-install{border-top:1px solid var(--line);background:var(--cream);padding:28px clamp(24px,4vw,66px) 34px}.quick-install h2{margin:0 0 14px;font-size:clamp(28px,3vw,46px);line-height:.95;letter-spacing:-.065em}.quick-install p{margin:0 0 18px;max-width:610px;color:#373737;font-size:18px;line-height:1.36}.button-row{display:flex;flex-wrap:wrap;gap:12px}.btn{appearance:none;border:1px solid var(--ink);background:#fff;color:var(--ink);display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 19px;border-radius:999px;font:700 14px/1 Messina-Sans,Arial,sans-serif;text-decoration:none;text-transform:uppercase;letter-spacing:.02em;cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,background .16s ease}.btn:hover{transform:translateY(-1px);box-shadow:0 12px 28px rgba(0,0,0,.12);text-decoration:none}.btn.yellow{background:var(--yellow)}.btn.black{background:var(--ink);color:#fff}.btn.ghost{background:transparent}.copy-btn{border:1px solid var(--ink);background:var(--yellow);border-radius:999px;min-height:38px;padding:0 14px;font:700 12px/1 Messina-Sans,Arial,sans-serif;text-transform:uppercase;letter-spacing:.03em;cursor:pointer}.copy-btn:hover{filter:brightness(.96)}.hero-right{position:relative;min-width:0;background:#fff}.marquee{height:46px;border-bottom:1px solid var(--line);display:flex;align-items:center;overflow:hidden;white-space:nowrap;background:var(--yellow);font-weight:700;text-transform:uppercase;letter-spacing:.1em}.marquee span{display:inline-block;padding-left:24px;animation:marquee 26s linear infinite}@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}.screen-wrap{padding:36px clamp(18px,3.2vw,54px) 40px}.agent-card{border:1px solid var(--line);background:#fff;box-shadow:14px 14px 0 var(--yellow)}.agent-head{height:58px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:0 18px;font-weight:700}.traffic{display:flex;gap:8px}.traffic i{width:11px;height:11px;border:1px solid var(--ink);border-radius:50%;background:#fff}.traffic i:nth-child(2){background:var(--yellow)}.traffic i:nth-child(3){background:#c8efc8}.agent-body{padding:22px}.agent-line{display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:start;margin-bottom:16px}.bubble{border:1px solid var(--line);border-radius:18px;padding:13px 15px;background:#fff;font-size:16px;line-height:1.35}.bubble.agent{background:#f8f8f8}.avatar{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;display:grid;place-items:center;font-weight:700;background:var(--yellow)}.seat-panel{margin-top:18px;border:1px solid var(--line);background:#fff}.seat-top{display:grid;grid-template-columns:1fr 160px;border-bottom:1px solid var(--line)}.poster{min-height:174px;background:#111;color:#fff;padding:22px;position:relative;overflow:hidden}.poster:before{content:"";position:absolute;left:22px;right:22px;bottom:31px;height:14px;border-radius:999px;background:var(--yellow);box-shadow:0 0 22px rgba(252,239,23,.55)}.poster b{display:block;font-size:34px;line-height:.96;letter-spacing:-.06em;max-width:360px}.poster small{display:block;margin-top:9px;color:#d7d7d7;font-size:15px}.ticket-stub{border-left:1px dashed var(--line);background:var(--yellow);display:grid;place-items:center;text-align:center;padding:16px;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.seats{padding:18px;background:#f9f9f9}.screen{height:20px;margin:0 auto 18px;width:min(420px,82%);background:var(--ink);color:var(--yellow);display:grid;place-items:center;font-size:11px;letter-spacing:.55em;font-weight:700}.seat-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:8px;max-width:590px;margin:0 auto}.seat{height:24px;border:1px solid #6f9d47;border-radius:0 0 9px 9px;background:#f4fbec}.seat.taken{background:#c9c9c9;border-color:#888}.seat.blocked{background:#fff;border-color:#111;position:relative}.seat.blocked:after{content:"";position:absolute;inset:2px;background:linear-gradient(45deg,transparent 47%,#111 49%,#111 51%,transparent 53%),linear-gradient(-45deg,transparent 47%,#111 49%,#111 51%,transparent 53%)}.seat.selected{background:var(--yellow);border-color:#111;box-shadow:0 0 0 2px #111 inset}.legend{display:flex;flex-wrap:wrap;gap:14px 22px;margin-top:17px;color:#333;font-size:14px}.legend span{display:flex;align-items:center;gap:8px}.legend i{width:22px;height:22px;border:1px solid var(--line);display:inline-block}.legend .l-selected{background:var(--yellow)}.legend .l-taken{background:#c9c9c9}.section{border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:54px clamp(20px,4vw,66px)}.section-header{display:grid;grid-template-columns:minmax(260px,.72fr) minmax(320px,1fr);gap:40px;align-items:end;margin-bottom:30px}.section-kicker{font-size:14px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:13px}.section h2{margin:0;font-size:clamp(42px,5.2vw,80px);line-height:.9;letter-spacing:-.075em}.section-desc{margin:0;color:#3d3d3d;font-size:20px;line-height:1.35;max-width:740px}.install-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--line);border-left:1px solid var(--line)}.install-card{min-height:250px;padding:24px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff;display:flex;flex-direction:column;justify-content:space-between;gap:22px}.install-card:nth-child(2n){background:#fafafa}.install-card h3{margin:0 0 9px;font-size:30px;line-height:.95;letter-spacing:-.055em}.install-card p{margin:0;color:#454545;line-height:1.35}.tag{display:inline-flex;align-self:flex-start;border:1px solid var(--line);border-radius:999px;padding:7px 10px;background:var(--yellow);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.code-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px}.code-card{border:1px solid var(--line);background:#fff;min-width:0}.code-head{height:52px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 14px 0 18px}.code-title{font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.code-card pre{margin:0;padding:18px;background:#111;color:#fffdf2;overflow:auto;max-height:480px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:-.015em}.code-card.large pre{max-height:680px}.copy-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;border:1px solid var(--line);background:#fff;padding:10px 10px 10px 16px}.copy-row code{font:14px/1.35 ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;overflow:auto}.behavior-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid var(--line);border-left:1px solid var(--line)}.behavior{padding:26px;min-height:225px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:#fff}.behavior:nth-child(2){background:var(--yellow)}.behavior h3{margin:0 0 12px;font-size:34px;line-height:.95;letter-spacing:-.06em}.behavior p{margin:0;color:#333;line-height:1.4}.footer{padding:44px 0 58px;text-align:center}.footer .mark{margin:0 auto 16px}.footer p{margin:0 auto 18px;max-width:760px;font-size:22px;line-height:1.26}.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(12px);background:#111;color:#fff;border-radius:999px;padding:12px 16px;font-weight:700;opacity:0;pointer-events:none;transition:.2s;z-index:100}.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}@media(max-width:1120px){.hero{grid-template-columns:1fr}.hero-left{border-right:0}.hero-right{border-top:1px solid var(--line)}.install-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.section-header,.code-layout{grid-template-columns:1fr}.nav-links{gap:14px;font-size:15px}.page{width:min(100%,calc(100% - 24px))}}@media(max-width:720px){.nav{height:auto;padding:14px 0;align-items:flex-start}.nav-links{justify-content:flex-end}.hero{min-height:auto}.hook{padding:38px 22px}.quick-install{padding:24px 22px}.screen-wrap{padding:24px 18px 30px}.seat-top{grid-template-columns:1fr}.ticket-stub{border-left:0;border-top:1px dashed var(--line);min-height:82px}.install-grid,.behavior-grid{grid-template-columns:1fr}.section{padding:38px 22px}h1{font-size:64px}.lead{font-size:21px}.hero-left{display:block}}
  </style>
</head>
<body>
  <header class="topbar">
    <nav class="page nav" aria-label="main navigation">
      <a class="brand" href="/" aria-label="Yorck Movie Agent home">
        <span class="mark" aria-hidden="true"><svg viewBox="0 0 64 64" role="img"><path fill="#1a1a1a" d="M32 2l5.1 5.3 7.2-1 2.7 6.8 7 2.3-.5 7.3 5.7 4.7-3.6 6.4 3.6 6.4-5.7 4.7.5 7.3-7 2.3-2.7 6.8-7.2-1L32 62l-5.1-5.3-7.2 1-2.7-6.8-7-2.3.5-7.3-5.7-4.7 3.6-6.4-3.6-6.4 5.7-4.7-.5-7.3 7-2.3 2.7-6.8 7.2 1L32 2z"/><path fill="#fff" d="M20.8 18.3h8.5v3.2h-1.8l4.8 8 4.8-8h-1.9v-3.2h8v3.2h-1.7l-7 11.3v8.1h3.1v3.2H26.4v-3.2h3.2v-8.1l-7.1-11.3h-1.7v-3.2z"/></svg></span>
        <span class="brand-text">Yorck<br/>Movie Agent</span>
      </a>
      <div class="nav-links">
        <a href="#install">Install</a>
        <a href="#prompt">Claude Code</a>
        <a href="#skill">Skill file</a>
        <a href="https://github.com/Mahir-Isikli/yorck-mcp">GitHub</a>
        <a class="nav-pill" href="/public/mcp">Public MCP</a>
      </div>
    </nav>
  </header>

  <main class="page">
    <section class="hero">
      <div class="hero-left">
        <div class="hook">
          <div class="eyebrow">Yorck Berlin · MCP · CLI · Claude skill</div>
          <h1>i taught my <span class="alpina">agent</span> how to book movie tickets.</h1>
          <p class="lead">A public connector for showtimes and seat maps, plus a local private MCP that can book Yorck Unlimited tickets after confirmation.</p>
        </div>
        <div class="quick-install">
          <h2>Claude Code should install it for you.</h2>
          <p>Paste the bootstrap prompt. It sends Claude Code to the GitHub repo, loads the skill, adds the Yorck MCP server, and smoke-tests the CLI.</p>
          <div class="button-row">
            <button class="btn yellow" data-copy="prompt-full">Copy full prompt</button>
            <button class="btn" data-copy="curl-prompt">Copy curl prompt</button>
            <a class="btn ghost" href="https://github.com/Mahir-Isikli/yorck-mcp">Open GitHub</a>
          </div>
        </div>
      </div>
      <div class="hero-right">
        <div class="marquee" aria-hidden="true"><span>public by default · private when you opt in · svg when it renders · html when it does not · checkout links without an account · booking only after confirmation · public by default · private when you opt in · svg when it renders · html when it does not · checkout links without an account · booking only after confirmation · </span></div>
        <div class="screen-wrap">
          <div class="agent-card">
            <div class="agent-head"><div class="traffic"><i></i><i></i><i></i></div><span>agent output preview</span></div>
            <div class="agent-body">
              <div class="agent-line"><div class="avatar">M</div><div class="bubble">find something low-stress tonight after 7. show me seats if you can.</div></div>
              <div class="agent-line"><div class="avatar">Y</div><div class="bubble agent">You are free tonight. I found an OV showing at delphi LUX with two good seats. Want me to open checkout or book with your Unlimited card?</div></div>
              <div class="seat-panel">
                <div class="seat-top"><div class="poster"><b>Devil Wears Prada 2</b><small>delphi LUX · 21:30 · OV · tonight</small></div><div class="ticket-stub">checkout<br/>ready</div></div>
                <div class="seats"><div class="screen">SCREEN</div><div class="seat-grid">${heroSeats()}</div><div class="legend"><span><i></i>available</span><span><i class="l-selected"></i>selected</span><span><i class="l-taken"></i>taken</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="install">
      <div class="section-header"><div><div class="section-kicker">install surfaces</div><h2>one project, four ways in.</h2></div><p class="section-desc">The connector gives tools. The skill teaches the model how to use them: when to search, when to return a checkout link, when to render SVG, and when to fall back to inline HTML.</p></div>
      <div class="install-grid">
        <article class="install-card"><div><span class="tag">Claude Web</span><h3>add the public connector</h3><p>No account required. Search showtimes, return seat maps, create calendar files, and hand off to Yorck checkout.</p></div><button class="btn yellow" data-copy="web-code">Copy URL</button></article>
        <article class="install-card"><div><span class="tag">Claude Code</span><h3>paste a bootstrap prompt</h3><p>Claude Code reads the repo, installs the skill, adds the MCP server, and tests a search command.</p></div><button class="btn yellow" data-copy="prompt-full">Copy prompt</button></article>
        <article class="install-card"><div><span class="tag">Local MCP</span><h3>keep credentials on your machine</h3><p>Use your own Yorck email, password, and Unlimited card. Booking remains confirmation-gated.</p></div><button class="btn yellow" data-copy="private-code">Copy command</button></article>
        <article class="install-card"><div><span class="tag">CLI</span><h3>use it without an agent</h3><p>Plan a movie, render a seat map as HTML, and open the result locally.</p></div><button class="btn yellow" data-copy="cli-code">Copy CLI</button></article>
      </div>
    </section>

    <section class="section" id="prompt">
      <div class="section-header"><div><div class="section-kicker">Claude Code prompt</div><h2>curl it, paste it, let the agent set itself up.</h2></div><p class="section-desc">This is the install story for developers: do not manually copy six snippets. Give Claude Code the setup prompt and let it wire the repo, skill, MCP server, and smoke test.</p></div>
      <div class="copy-row"><code id="curl-prompt">${escapeHtml(curlPrompt)}</code><button class="copy-btn" data-copy="curl-prompt">Copy curl</button></div>
      <div style="height:18px"></div>
      <div class="code-card large"><div class="code-head"><div class="code-title">claude-code-prompt.md</div><button class="copy-btn" data-copy="prompt-full">Copy prompt</button></div><pre id="prompt-full">${claudePrompt}</pre></div>
    </section>

    <section class="section">
      <div class="section-header"><div><div class="section-kicker">copyable setup</div><h2>for people who want the exact snippets.</h2></div><p class="section-desc">Everything stays copyable. Public mode is read-only. Private mode runs locally with environment variables.</p></div>
      <div class="code-layout">
        <div class="code-card"><div class="code-head"><div class="code-title">Claude Web connector URL</div><button class="copy-btn" data-copy="web-code">Copy</button></div><pre id="web-code">${escapeHtml(claudeWeb)}</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Upload Claude skill ZIP</div><button class="copy-btn" data-copy="skillzip-code">Copy</button></div><pre id="skillzip-code">${escapeHtml(skillZip)}</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Claude Code public MCP</div><button class="copy-btn" data-copy="cc-public-code">Copy</button></div><pre id="cc-public-code">${escapeHtml(claudePublic)}</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Install the skill locally</div><button class="copy-btn" data-copy="skill-code">Copy</button></div><pre id="skill-code">${escapeHtml(localSkill)}</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Private local booking MCP</div><button class="copy-btn" data-copy="private-code">Copy</button></div><pre id="private-code">${escapeHtml(privateMcp)}</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">CLI quick start</div><button class="copy-btn" data-copy="cli-code">Copy</button></div><pre id="cli-code">${escapeHtml(cliQuickstart)}</pre></div>
      </div>
    </section>

    <section class="section">
      <div class="section-header"><div><div class="section-kicker">rendering strategy</div><h2>SVG when it works. HTML when it does not.</h2></div><p class="section-desc">Different agent surfaces handle rich output differently. The skill tells the model which output to choose so a seat map is still useful in Claude Web, Claude Code, and plain terminals.</p></div>
      <div class="behavior-grid">
        <div class="behavior"><h3>seat_map</h3><p>Use this when the client can display SVG or image content. It returns structured rows and an SVG seat map.</p></div>
        <div class="behavior"><h3>seat_map_html</h3><p>Use this in Claude Code or text-first clients when SVG does not render. Save the HTML and open it locally.</p></div>
        <div class="behavior"><h3>checkout link</h3><p>When booking is not configured, return Yorck's checkout URL so the user can finish manually as guest or with their account.</p></div>
      </div>
    </section>

    <section class="section" id="skill">
      <div class="section-header"><div><div class="section-kicker">the skill file</div><h2>the behavior lives in one markdown file.</h2></div><p class="section-desc">Install this alongside the MCP server. It teaches the agent the tool order, public vs private behavior, and the fallback path for seat maps.</p></div>
      <div class="code-card large"><div class="code-head"><div class="code-title">SKILL.md</div><button class="copy-btn" data-copy="skill-md">Copy SKILL.md</button></div><pre id="skill-md">${skillMarkdown}</pre></div>
    </section>

    <section class="footer">
      <span class="mark" aria-hidden="true"><svg viewBox="0 0 64 64" role="img"><path fill="#1a1a1a" d="M32 2l5.1 5.3 7.2-1 2.7 6.8 7 2.3-.5 7.3 5.7 4.7-3.6 6.4 3.6 6.4-5.7 4.7.5 7.3-7 2.3-2.7 6.8-7.2-1L32 62l-5.1-5.3-7.2 1-2.7-6.8-7-2.3.5-7.3-5.7-4.7 3.6-6.4-3.6-6.4 5.7-4.7-.5-7.3 7-2.3 2.7-6.8 7.2 1L32 2z"/><path fill="#fff" d="M20.8 18.3h8.5v3.2h-1.8l4.8 8 4.8-8h-1.9v-3.2h8v3.2h-1.7l-7 11.3v8.1h3.1v3.2H26.4v-3.2h3.2v-8.1l-7.1-11.3h-1.7v-3.2z"/></svg></span>
      <p>Public by default. Private only when you opt in. Real-world actions only after confirmation.</p>
      <div class="button-row" style="justify-content:center"><a class="btn yellow" href="https://github.com/Mahir-Isikli/yorck-mcp">View GitHub repo</a><a class="btn black" href="/skill.zip">Download skill.zip</a></div>
    </section>
  </main>

  <div class="toast" id="toast">copied</div>
  <script>
    const toast = document.getElementById('toast');
    function showToast(){ toast.classList.add('show'); window.setTimeout(function(){ toast.classList.remove('show'); }, 1300); }
    async function copyText(text){
      try { await navigator.clipboard.writeText(text); }
      catch(e){ const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
      showToast();
    }
    document.querySelectorAll('[data-copy]').forEach(function(btn){
      btn.addEventListener('click', function(){
        const id = btn.getAttribute('data-copy');
        const el = document.getElementById(id);
        copyText(el ? el.innerText.trim() : '');
      });
    });
  </script>
</body>
</html>`;
}
