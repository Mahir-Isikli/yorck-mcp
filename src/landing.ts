export function landingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>yorck-mcp</title>
  <meta name="description" content="Installable Yorck Berlin cinema MCP, CLI, and agent skill." />
  <style>
    :root{color-scheme:light dark;--bg:#f7f3eb;--fg:#171717;--muted:#6b625a;--card:rgba(255,255,255,.78);--line:rgba(45,37,30,.12);--accent:#d62828;--green:#166534;--blue:#355cff;--shadow:0 28px 90px rgba(44,32,23,.12)}
    @media(prefers-color-scheme:dark){:root{--bg:#111;--fg:#f8f3eb;--muted:#b9afa5;--card:rgba(28,28,28,.78);--line:rgba(255,255,255,.12);--shadow:0 28px 90px rgba(0,0,0,.35)}}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 12% 0%,rgba(214,40,40,.18),transparent 34rem),radial-gradient(circle at 80% 15%,rgba(53,92,255,.14),transparent 30rem),var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1180px;margin:0 auto;padding:58px 22px 76px}.nav{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;margin-bottom:58px}.brand{font-weight:900;letter-spacing:-.04em;font-size:24px}.links{display:flex;gap:10px;flex-wrap:wrap}.pill,.tab{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--card);backdrop-filter:blur(18px);border-radius:999px;padding:9px 13px;color:var(--muted);font-weight:800;font-size:14px;text-decoration:none}.hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(320px,.92fr);gap:26px;align-items:center}.eyebrow{color:var(--accent);font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:13px}h1{font-size:clamp(48px,8vw,104px);letter-spacing:-.085em;line-height:.88;margin:12px 0 18px}h2{font-size:30px;letter-spacing:-.045em;margin:0 0 12px}h3{font-size:20px;letter-spacing:-.025em;margin:0 0 8px}p{color:var(--muted);font-size:18px;line-height:1.58}.hero p{font-size:21px;max-width:720px}.cta{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.button{border:1px solid var(--line);border-radius:999px;padding:13px 18px;text-decoration:none;font-weight:900;color:var(--fg);background:var(--card);box-shadow:var(--shadow)}.button.primary{background:#111;color:#fff}.card{background:var(--card);border:1px solid var(--line);border-radius:30px;padding:24px;box-shadow:var(--shadow);backdrop-filter:blur(20px)}.demo{display:grid;gap:14px}.screen{background:#111;color:#f8f3eb;border-radius:24px;padding:18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.55;overflow:auto}.mini{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.metric{background:rgba(255,255,255,.62);border:1px solid var(--line);border-radius:20px;padding:15px;text-align:center}.metric b{display:block;font-size:30px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:22px 0}.section{margin-top:54px}.install-grid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px}.tabs{display:grid;gap:8px}.tab{cursor:pointer;justify-content:flex-start}.tab.active{color:#fff;background:#111}.panel{display:none}.panel.active{display:block}.copy{float:right;border:0;border-radius:999px;background:#fff;color:#111;padding:6px 10px;font-weight:900;cursor:pointer}.list{padding-left:20px;color:var(--muted);line-height:1.8}.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111;color:#fff;border-radius:999px;padding:10px 14px;font-weight:800;opacity:0;transition:.2s}.toast.show{opacity:1}@media(max-width:820px){.hero,.install-grid{grid-template-columns:1fr}h1{font-size:58px}.mini{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <nav class="nav"><div class="brand">yorck-mcp</div><div class="links"><a class="pill" href="/public/mcp">public MCP</a><a class="pill" href="/claude-code-prompt.md">Claude Code prompt</a><a class="pill" href="/skill/SKILL.md">SKILL.md</a><a class="pill" href="/skill.zip">skill.zip</a><a class="pill" href="https://github.com/Mahir-Isikli/yorck-mcp">GitHub</a><a class="pill" href="https://www.npmjs.com/package/yorck-mcp">npm</a></div></nav>
    <section class="hero">
      <div>
        <div class="eyebrow">Berlin cinema for agents</div>
        <h1>movie nights, as an installable agent skill.</h1>
        <p>Search Yorck showtimes, render seat maps, create calendar files, return checkout links, and optionally book Unlimited tickets from a local MCP server with your own credentials.</p>
        <div class="cta"><a class="button primary" href="#install">Install</a><a class="button" href="/skill/SKILL.md">Copy skill</a><a class="button" href="https://mahir.is/posts/yorck-mcp-public-cinema-agent">Read the build note</a></div>
      </div>
      <div class="card demo">
        <div class="screen">npx -y yorck-mcp plan --q "prada" --when tonight\n\n=> checkout link\n=> seat-plan summary\n=> calendar command</div>
        <div class="mini"><div class="metric"><span>search</span><b>90ms</b></div><div class="metric"><span>mode</span><b>public</b></div><div class="metric"><span>booking</span><b>local</b></div></div>
      </div>
    </section>

    <section class="section grid">
      <div class="card"><h3>Public connector</h3><p>No account needed. Add a custom connector in Claude Web or Claude Desktop using the remote MCP endpoint.</p></div>
      <div class="card"><h3>Local MCP</h3><p>Use Claude Code, Cursor, or local agents with <code>npx -y yorck-mcp mcp-stdio</code>.</p></div>
      <div class="card"><h3>Agent skill</h3><p>Install one <code>SKILL.md</code> so Claude knows when to use SVG, inline HTML, checkout links, or private booking.</p></div>
      <div class="card"><h3>HTML fallback</h3><p>If a client cannot render MCP images/SVG, use <code>seat_map_html</code> or <code>seat-map-html</code> for a portable inline page.</p></div>
    </section>

    <section class="section card" id="install">
      <h2>Install options</h2>
      <p>Pick the surface you are using. Public modes are read-only. Private booking uses local environment variables and confirmation gates.</p>
      <div class="install-grid">
        <div class="tabs">
          <button class="tab active" data-tab="claude-web">Claude Web connector</button>
          <button class="tab" data-tab="claude-code-prompt">Claude Code prompt</button>
          <button class="tab" data-tab="claude-code-public">Claude Code public</button>
          <button class="tab" data-tab="claude-code-private">Claude Code private</button>
          <button class="tab" data-tab="skill">Claude skill</button>
          <button class="tab" data-tab="cli">CLI</button>
          <button class="tab" data-tab="html">Inline HTML fallback</button>
        </div>
        <div>
          <div class="panel active" id="claude-web"><h3>Claude Web / custom connector</h3><p>Customize → Connectors → Add custom connector, then paste:</p><pre class="screen"><button class="copy">copy</button>https://yorck-mcp.isiklimahir.workers.dev/public/mcp</pre><p>Then upload the skill ZIP from <a href="/skill.zip">/skill.zip</a> under Customize → Skills.</p></div>
          <div class="panel" id="claude-code-prompt"><h3>Claude Code bootstrap prompt</h3><p>Paste this into Claude Code and let it install the repo, npm package, skill, and MCP config for you.</p><pre class="screen"><button class="copy">copy</button>curl -fsSL https://yorck-mcp.isiklimahir.workers.dev/claude-code-prompt.md</pre><p>Or open <a href="/claude-code-prompt.md">the prompt</a> and copy it.</p></div>
          <div class="panel" id="claude-code-public"><h3>Claude Code, public tools</h3><pre class="screen"><button class="copy">copy</button>claude mcp add --transport http yorck https://yorck-mcp.isiklimahir.workers.dev/public/mcp</pre></div>
          <div class="panel" id="claude-code-private"><h3>Claude Code, local bookable MCP</h3><pre class="screen"><button class="copy">copy</button>claude mcp add --transport stdio \\
  --env YORCK_EMAIL=you@example.com \\
  --env YORCK_PASSWORD=your-password \\
  --env YORCK_UNLIMITED_CARD=your-card-number \\
  yorck -- npx -y yorck-mcp mcp-stdio</pre></div>
          <div class="panel" id="skill"><h3>Install the skill file</h3><p>Claude Web skills can upload the ZIP. Claude Code can install the filesystem skill.</p><pre class="screen"><button class="copy">copy</button>https://yorck-mcp.isiklimahir.workers.dev/skill.zip</pre><pre class="screen"><button class="copy">copy</button>curl -fsSL https://yorck-mcp.isiklimahir.workers.dev/install.sh | bash</pre><p>Or from npm:</p><pre class="screen"><button class="copy">copy</button>npx -y yorck-mcp install-skill --target claude</pre></div>
          <div class="panel" id="cli"><h3>Use it directly</h3><pre class="screen"><button class="copy">copy</button>npx -y yorck-mcp whats-on --when tonight --after 18:00
npx -y yorck-mcp plan --q "devil wears prada" --when tonight
npx -y yorck-mcp seat-map 1007-30456 --out seat-map.svg</pre></div>
          <div class="panel" id="html"><h3>When SVG does not render</h3><pre class="screen"><button class="copy">copy</button>npx -y yorck-mcp seat-map-html 1007-30456 --out seat-map.html
open seat-map.html</pre></div>
        </div>
      </div>
    </section>

    <section class="section grid">
      <div class="card"><h2>Public tools</h2><ul class="list"><li><code>whats_on</code>, search showtimes</li><li><code>pick_showtime</code>, pick one good plan</li><li><code>seat_map</code>, SVG/image output</li><li><code>seat_map_html</code>, inline HTML fallback</li><li><code>add_to_calendar</code>, ICS file</li></ul></div>
      <div class="card"><h2>Private tools</h2><ul class="list"><li><code>book_session</code>, Unlimited booking after confirmation</li><li><code>cancel_booking</code>, release a held order</li><li>Paid checkout stays on Yorck's website via checkout link.</li></ul></div>
    </section>
  </main>
  <div class="toast" id="toast">copied</div>
  <script>
    const tabs=[...document.querySelectorAll('.tab')],panels=[...document.querySelectorAll('.panel')];
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));panels.forEach(p=>p.classList.remove('active'));t.classList.add('active');document.getElementById(t.dataset.tab).classList.add('active')});
    const toast=document.getElementById('toast');
    document.querySelectorAll('.copy').forEach(btn=>btn.onclick=async()=>{const pre=btn.parentElement;const txt=pre.innerText.replace(/^copy\n?/,'');await navigator.clipboard.writeText(txt);toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1200)});
  </script>
</body>
</html>`;
}
