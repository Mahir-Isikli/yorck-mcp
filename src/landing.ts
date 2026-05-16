export function landingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>yorck-mcp</title>
  <meta name="description" content="Installable Yorck Berlin cinema MCP, CLI, and agent skill." />
  <style>
    @font-face{font-family:Messina;src:url(https://www.yorck.de/fonts/MessinaSansWeb-Regular.woff2) format("woff2");font-weight:400}
    @font-face{font-family:Messina;src:url(https://www.yorck.de/fonts/MessinaSansWeb-Bold.woff2) format("woff2");font-weight:800}
    @font-face{font-family:Alpina;src:url(https://www.yorck.de/fonts/GT-Alpina-Standard-Light.woff2) format("woff2");font-weight:400}
    :root{--bg:#f8f4ec;--bg2:#eee7db;--paper:rgba(255,255,255,.68);--paper2:rgba(255,255,255,.92);--ink:#171513;--muted:#6f665c;--line:rgba(24,21,18,.13);--soft:0 14px 42px rgba(44,35,24,.09);--shadow:0 28px 90px rgba(44,35,24,.16);--yellow:#fcef17;--green:#0d6b51;--red:#d72128;--radius:28px}
    *{box-sizing:border-box}html{scroll-behavior:smooth;overflow-x:hidden}body{margin:0;min-height:100vh;overflow-x:hidden;background:radial-gradient(circle at 8% 4%,rgba(252,239,23,.26),transparent 30%),radial-gradient(circle at 88% 7%,rgba(215,33,40,.11),transparent 28%),linear-gradient(135deg,#fbf8f2 0%,var(--bg) 55%,var(--bg2) 100%);color:var(--ink);font-family:Messina,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:-.02em}body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.45) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.34) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(circle at 50% 18%,black,transparent 72%)}a{color:inherit}.wrap{width:min(1180px,calc(100% - 36px));margin:0 auto;position:relative}.nav{position:sticky;top:14px;z-index:20;width:min(1180px,calc(100% - 36px));margin:14px auto 0;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 12px;border:1px solid rgba(255,255,255,.74);border-radius:24px;background:rgba(255,255,255,.58);backdrop-filter:blur(22px) saturate(1.25);box-shadow:var(--soft),inset 0 0 0 1px rgba(255,255,255,.48)}.brand{display:flex;align-items:center;gap:12px;min-width:0;text-decoration:none;font-weight:900;letter-spacing:-.045em}.mark{width:42px;height:42px;border-radius:15px;background:#111;color:var(--yellow);display:grid;place-items:center;font-weight:900;box-shadow:0 12px 32px rgba(23,21,19,.18);flex:0 0 auto}.brand span{white-space:nowrap}.nav-links{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}.nav a:not(.brand){text-decoration:none;color:#443d35;font-size:14px;font-weight:760;padding:10px 12px;border-radius:999px}.nav a:not(.brand):hover{background:rgba(255,255,255,.78)}.nav .install-link{background:var(--ink);color:white!important;box-shadow:0 10px 26px rgba(23,21,19,.16)}.hero{padding:76px 0 42px}.hero-grid{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:30px;align-items:center}.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:9px 13px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.66);color:#4e463d;font-size:14px;font-weight:760;backdrop-filter:blur(16px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.42)}h1{max-width:780px;margin:20px 0 16px;font-size:clamp(48px,7.6vw,94px);line-height:.9;letter-spacing:-.085em;text-wrap:balance}.serif{font-family:Alpina,Georgia,serif;font-weight:400;letter-spacing:-.055em}.lead{max-width:660px;margin:0 0 26px;color:#50473e;font-size:clamp(18px,1.9vw,24px);line-height:1.28;letter-spacing:-.04em}.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.button{appearance:none;border:0;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border-radius:17px;background:var(--ink);color:white;box-shadow:0 16px 36px rgba(23,21,19,.18);font-size:15px;font-weight:860;transition:transform .18s ease,box-shadow .18s ease}.button:hover{transform:translateY(-1px);box-shadow:0 20px 44px rgba(23,21,19,.23)}.button.secondary{background:rgba(255,255,255,.76);color:var(--ink);border:1px solid var(--line);box-shadow:var(--soft)}.button.yellow{background:var(--yellow);color:#111}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:22px}.stat{padding:16px;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.56);backdrop-filter:blur(18px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.34)}.stat b{display:block;font-size:24px;letter-spacing:-.06em}.stat span{color:var(--muted);font-size:13px}.example-shell{border:1px solid rgba(255,255,255,.76);background:rgba(255,255,255,.48);border-radius:36px;padding:14px;backdrop-filter:blur(24px) saturate(1.2);box-shadow:var(--shadow),inset 0 0 0 1px rgba(255,255,255,.46)}.example-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 8px 14px;color:#403932;font-weight:800;font-size:14px}.dots{display:flex;gap:7px}.dot{width:10px;height:10px;border-radius:50%;background:#e35d5b}.dot:nth-child(2){background:#e6bc4a}.dot:nth-child(3){background:#4baf72}.movie-card{display:grid;gap:14px;border:1px solid var(--line);background:rgba(255,255,255,.78);border-radius:28px;padding:18px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.46)}.ticket{background:#111;color:#fff;border-radius:24px;padding:22px;min-height:190px;position:relative;overflow:hidden}.ticket:after{content:"";position:absolute;left:22px;right:22px;top:112px;height:10px;border-radius:999px;background:var(--yellow);box-shadow:0 0 24px rgba(252,239,23,.45)}.ticket h3{font-size:34px;letter-spacing:-.06em;margin:0 0 8px}.ticket p{color:#cfc9be;margin:0}.screen-word{position:absolute;right:22px;top:94px;color:var(--yellow);font-weight:900;letter-spacing:.45em}.seat-preview{display:grid;grid-template-columns:repeat(12,1fr);gap:8px;padding:12px 4px}.seat{height:22px;border-radius:7px;border:1px solid #7aa35c;background:#edf5df}.seat.taken{border-color:#cd6a63;background:#f8e9e6}.seat.pick{background:var(--yellow);border-color:#111;box-shadow:0 0 0 2px #111 inset}.label-row{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:13px;font-weight:760}section{padding:38px 0}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}h2{margin:0;font-size:clamp(34px,4vw,56px);line-height:.98;letter-spacing:-.075em;text-wrap:balance}.sub{color:var(--muted);max-width:640px;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card,.code-card{border:1px solid rgba(255,255,255,.74);border-radius:var(--radius);background:var(--paper);backdrop-filter:blur(20px) saturate(1.15);box-shadow:var(--soft),inset 0 0 0 1px rgba(255,255,255,.42)}.card{padding:22px}.card h3{margin:0 0 8px;font-size:21px;letter-spacing:-.05em}.card p{margin:0;color:var(--muted);line-height:1.42}.code-card{overflow:hidden}.code-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:13px 14px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.54)}.code-title{font-weight:820;font-size:14px;color:#3d362e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.copy{border:1px solid var(--line);background:rgba(255,255,255,.86);color:var(--ink);border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:820;white-space:nowrap}.copy:hover{background:var(--yellow)}pre{margin:0;padding:18px;overflow:auto;font-size:13px;line-height:1.48;background:rgba(28,25,22,.95);color:#fff7eb;letter-spacing:-.01em;max-height:680px}.install-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.prompt-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(280px,.85fr);gap:16px}.list{padding-left:20px;color:var(--muted);line-height:1.8}.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:#111;color:#fff;border-radius:999px;padding:10px 14px;font-weight:820;opacity:0;transition:.2s;z-index:99}.toast.show{opacity:1}@media(max-width:900px){.hero-grid,.install-grid,.prompt-grid{grid-template-columns:1fr}.stats{grid-template-columns:1fr}h1{font-size:58px}.nav{position:relative;top:0}.section-head{display:block}}
  </style>
</head>
<body>
  <nav class="nav"><a class="brand" href="/"><div class="mark">Y</div><span>yorck-mcp</span></a><div class="nav-links"><a href="/public/mcp">public MCP</a><a href="/claude-code-prompt.md">Claude Code prompt</a><a href="/skill.zip">skill.zip</a><a href="https://github.com/Mahir-Isikli/yorck-mcp">GitHub</a><a class="install-link" href="#install">Install</a></div></nav>
  <main class="wrap">
    <section class="hero">
      <div class="hero-grid">
        <div>
          <div class="eyebrow">Yorck Berlin cinema · MCP + skill + CLI</div>
          <h1><span class="serif">movie night</span> as a thing your agent can do.</h1>
          <p class="lead">Search what is playing, render seats, create calendar files, return checkout links, and optionally book Yorck Unlimited tickets from a local private MCP.</p>
          <div class="actions"><a class="button yellow" href="#prompt">Copy Claude Code prompt</a><a class="button" href="#install">Install options</a><a class="button secondary" href="/skill.zip">Download skill.zip</a></div>
          <div class="stats"><div class="stat"><b>public</b><span>search, seats, calendar, links</span></div><div class="stat"><b>local</b><span>private booking credentials stay local</span></div><div class="stat"><b>HTML</b><span>fallback when SVG does not render</span></div></div>
        </div>
        <div class="example-shell">
          <div class="example-head"><div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><span>seat-map-html fallback</span></div>
          <div class="movie-card">
            <div class="ticket"><h3>delphi LUX · Saal 1</h3><p>Devil Wears Prada 2 · 21:30 · OV · tonight</p><div class="screen-word">SCREEN</div></div>
            <div class="label-row"><span>available</span><span>picked by agent</span><span>checkout link</span></div>
            <div class="seat-preview">${Array.from({ length: 96 }, (_, i) => `<span class="seat ${[9,10,34,35,36,53,54,55,80].includes(i) ? "taken" : i === 62 ? "pick" : ""}"></span>`).join("")}</div>
          </div>
        </div>
      </div>
    </section>

    <section>
      <div class="section-head"><h2>What it installs</h2><p class="sub">Use the public connector in Claude Web, a local MCP in Claude Code, or the CLI directly. Add the skill so the model knows when to return SVG, inline HTML, checkout links, or booking confirmation.</p></div>
      <div class="grid">
        <div class="card"><h3>Public connector</h3><p>Add the remote MCP URL in Claude Web or Desktop. No account needed, read-only tools only.</p></div>
        <div class="card"><h3>Claude Code prompt</h3><p>Paste one bootstrap prompt into Claude Code. It reads the repo, installs the skill, adds MCP, and smoke-tests.</p></div>
        <div class="card"><h3>Local bookable MCP</h3><p>Run <code>npx -y yorck-mcp mcp-stdio</code> with your own Yorck credentials. Booking asks for confirmation.</p></div>
        <div class="card"><h3>Inline HTML seats</h3><p>When the client cannot display MCP SVG/image output, use <code>seat_map_html</code> or <code>seat-map-html</code>.</p></div>
      </div>
    </section>

    <section id="prompt">
      <div class="section-head"><h2>Claude Code bootstrap prompt</h2><p class="sub">This is the easiest Claude Code install path: paste the prompt, let Claude Code set itself up, then test with a movie request.</p></div>
      <div class="prompt-grid">
        <div class="code-card"><div class="code-head"><div class="code-title">prompt to paste into Claude Code</div><button class="copy" data-copy="prompt-code">Copy prompt</button></div><pre id="prompt-code">curl -fsSL https://yorck-mcp.isiklimahir.workers.dev/claude-code-prompt.md</pre></div>
        <div class="card"><h3>What Claude Code will do</h3><ul class="list"><li>read the public GitHub repo</li><li>install the Claude skill</li><li>add the public MCP connector</li><li>smoke-test the CLI</li><li>use HTML fallback for seat maps when needed</li></ul></div>
      </div>
    </section>

    <section id="install">
      <div class="section-head"><h2>Install options</h2><p class="sub">Copy the path that matches your environment. Public modes do not require credentials. Private booking uses local environment variables.</p></div>
      <div class="install-grid">
        <div class="code-card"><div class="code-head"><div class="code-title">Claude Web custom connector</div><button class="copy" data-copy="web-code">Copy</button></div><pre id="web-code">https://yorck-mcp.isiklimahir.workers.dev/public/mcp</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Upload skill in Claude Web</div><button class="copy" data-copy="skillzip-code">Copy</button></div><pre id="skillzip-code">https://yorck-mcp.isiklimahir.workers.dev/skill.zip</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Claude Code public MCP</div><button class="copy" data-copy="cc-public-code">Copy</button></div><pre id="cc-public-code">claude mcp add --transport http yorck https://yorck-mcp.isiklimahir.workers.dev/public/mcp</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Install local skill</div><button class="copy" data-copy="skill-code">Copy</button></div><pre id="skill-code">npx -y yorck-mcp install-skill --target claude</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">CLI quick start</div><button class="copy" data-copy="cli-code">Copy</button></div><pre id="cli-code">npx -y yorck-mcp whats-on --when tonight --after 18:00
npx -y yorck-mcp plan --q "devil wears prada" --when tonight
npx -y yorck-mcp seat-map-html &lt;session-id&gt; --out seat-map.html</pre></div>
        <div class="code-card"><div class="code-head"><div class="code-title">Private local booking MCP</div><button class="copy" data-copy="private-code">Copy</button></div><pre id="private-code">claude mcp add --transport stdio \\
  --env YORCK_EMAIL=you@example.com \\
  --env YORCK_PASSWORD=your-password \\
  --env YORCK_UNLIMITED_CARD=your-card-number \\
  yorck-private -- npx -y yorck-mcp mcp-stdio</pre></div>
      </div>
    </section>

    <section>
      <div class="grid">
        <div class="card"><h2>Public tools</h2><ul class="list"><li><code>whats_on</code>, search showtimes</li><li><code>pick_showtime</code>, pick one good plan</li><li><code>seat_map</code>, SVG/image output</li><li><code>seat_map_html</code>, inline HTML fallback</li><li><code>add_to_calendar</code>, ICS file</li></ul></div>
        <div class="card"><h2>Safety rules</h2><ul class="list"><li>public mode never books</li><li>private mode keeps credentials local</li><li>booking is confirmation-gated</li><li>paid checkout stays on Yorck's site</li><li>do not claim booking unless the tool succeeds</li></ul></div>
      </div>
    </section>
  </main>
  <div class="toast" id="toast">copied</div>
  <script>
    const toast=document.getElementById('toast');
    async function copyText(text){try{await navigator.clipboard.writeText(text)}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove()}toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1200)}
    document.querySelectorAll('.copy').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.getAttribute('data-copy');const el=document.getElementById(id);copyText(el?el.innerText.trim():'')}));
  </script>
</body>
</html>`;
}
