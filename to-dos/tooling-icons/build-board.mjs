// Rebuilds board.html from the SVGs beside it:  node to-dos/tooling-icons/build-board.mjs
// The board is self-contained (every mark is inlined as a data URI) because only `.html`
// files under to-dos/ reach the deployed app. Any `svg/<app>-<n>-<label>.svg` is a candidate,
// so a new variant is a new file and a rebuild.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p) => readFileSync(join(here, p), 'utf8')
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64')
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

// name / blurb / href mirror src/lib/toolingFamily.ts; live + lean come from HANDOFF.md §4 and §7.
const APPS = [
  { key: 'bid', name: 'BidTooling', blurb: 'Plumbing bid worksheet', href: 'https://bidtooling.com/', live: 'favicon.svg', lean: 'Open — both clean. Refined has a bigger clip so the clipboard survives 16px.' },
  { key: 'plumbing', name: 'Plumbing Tooling', blurb: 'Hydrostatic and gas test reports', href: 'https://plumbingtooling.com/', live: 'img/favicon.svg', lean: 'Unresolved — the refinement drifts toward Takeoff Tooling. The site retires ~2026-10-11 (to-dos/test-reports), so this row may be skipped.' },
  { key: 'lien', name: 'LienTooling', blurb: "Mechanic's liens and releases", href: 'https://lientooling.com/', live: 'favicon.svg (9 pages link it, 4 have none)', lean: 'Take refined — the handle no longer fuses with the block at 16px.' },
  { key: 'paper', name: 'PaperTooling', blurb: 'Select, compress and download PDFs', href: 'https://papertooling.com/', live: 'favicon.svg', lean: 'Take refined — chevron and head 52 units apart instead of 22.' },
  { key: 'pay', name: 'PayTooling', blurb: 'Contractor pay stubs', href: 'https://paytooling.com/', live: 'favicon.svg (+ a duplicate shortcut icon)', lean: 'Take refined — deeper tear teeth; measures clean.' },
  { key: 'sub', name: 'SubTooling', blurb: 'Job value calculator for subs', href: 'https://subtooling.com/', live: 'favicon.svg (+ a duplicate shortcut icon)', lean: 'Take refined — the blunt roof removes the taper; measures clean.' },
  { key: 'sign', name: 'SignTooling', blurb: 'Contract signing portal', href: 'https://signtooling.com/', live: null, lean: 'Open — both clean. As chosen reads as a waveform and echoes Takeoff Tooling.' },
  { key: 'sync', name: 'SyncTooling', blurb: 'Project management', href: 'https://synctooling.com/', live: null, lean: 'Open, lean refined — two bars say "tasks"; one bar reads as a pause button.' },
  { key: 'connect', name: 'ConnectTooling', blurb: 'Team communication', href: 'https://connecttooling.com/', live: null, lean: 'Take refined, but the weakest of the ten — the radio has never measured well. Deserves another pass.' },
  { key: 'gov', name: 'GovTooling', blurb: 'Certified payroll and government forms', href: 'https://govtooling.com/', live: '404', lean: 'Take refined — even 40-unit bands. The seal still detaches at 16px.' },
]

const audit = JSON.parse(read('audit.json'))
const markById = new Map(audit.marks.map((m) => [m.id, m]))
const auditIdFor = (n) => (n === '1' ? 'current' : n === '2' ? 'refined' : null)

const num = (f) => Number((/-(\d+)-/.exec(f) || [])[1] || 0)
const files = readdirSync(join(here, 'svg')).filter((f) => f.endsWith('.svg')).sort((a, b) => a.split('-')[0].localeCompare(b.split('-')[0]) || num(a) - num(b))
const candidatesFor = (key) =>
  files
    .filter((f) => f.startsWith(key + '-'))
    .map((f) => {
      const m = /^[a-z]+-(\d+)-(.+)\.svg$/.exec(f)
      const n = m ? m[1] : '?'
      const label = m ? m[2].replace(/-/g, ' ') : f
      const measured = markById.get(`${key}/${auditIdFor(n)}`)
      const flags = measured
        ? Object.entries(measured.metrics).filter(([, v]) => v.verdict !== 'pass').map(([k, v]) => `${k} ${v.value}${v.note ? ` (${v.note})` : ''}`)
        : []
      return { id: `${key}-${n}`, file: f, n, label, src: uri(read('svg/' + f)), verdict: measured ? measured.verdict : 'unmeasured', flags }
    })

const shipping = ['counttooling', 'takeofftooling', 'clicktooling'].map((n) => ({ name: n, src: uri(read(`shipping/${n}.svg`)) }))

const ladder = (src) => `
  <div class="ladder light"><img src="${src}" width="48" height="48" alt=""><img src="${src}" width="32" height="32" alt=""><img src="${src}" width="16" height="16" alt=""></div>
  <div class="ladder dark"><img src="${src}" width="48" height="48" alt=""><img src="${src}" width="32" height="32" alt=""><img src="${src}" width="16" height="16" alt=""></div>`

const rows = APPS.map((app) => {
  const cands = candidatesFor(app.key)
  const liveFile = `current/${app.key}.svg`
  const liveSrc = existsSync(join(here, liveFile)) ? uri(read(liveFile)) : null
  const live = liveSrc
    ? `<img class="big" src="${liveSrc}" width="96" height="96" alt="">${ladder(liveSrc)}<p class="meta">${esc(app.live)}</p>`
    : `<div class="none">${app.live === '404' ? 'links /favicon.svg — the file does not exist (404)' : 'no icon at all'}</div>`
  return `
<section class="app" data-app="${app.key}">
  <header>
    <h2>${esc(app.name)}</h2>
    <p class="blurb">${esc(app.blurb)} · <a href="${app.href}" target="_blank" rel="noopener">${esc(app.href.replace(/^https:\/\/|\/$/g, ''))}</a> · <a href="https://github.com/clickconstruction/${app.key}tooling.github.io" target="_blank" rel="noopener">repo</a></p>
    <p class="lean">${esc(app.lean)}</p>
  </header>
  <div class="cols">
    <div class="col live"><h3>Live today</h3>${live}</div>
    ${cands.map((c) => `
    <label class="col cand" data-cand="${c.id}">
      <h3><input type="radio" name="pick-${app.key}" value="${c.id}"> ${esc(c.n)} · ${esc(c.label)}</h3>
      <img class="big" src="${c.src}" width="96" height="96" alt="">${ladder(c.src)}
      <p class="meta"><span class="chip ${c.verdict}">${c.verdict}</span> ${c.flags.length ? esc(c.flags.join(' · ')) : c.verdict === 'pass' ? 'clean' : ''}</p>
      <p class="meta file">svg/${esc(c.file)}</p>
    </label>`).join('')}
    <label class="col skip"><h3><input type="radio" name="pick-${app.key}" value="skip"> Skip this app</h3></label>
  </div>
  <textarea data-note="${app.key}" placeholder="Notes for ${esc(app.name)} — what to change, what reads wrong…" rows="2"></textarea>
</section>`
}).join('\n')

// The owner's recorded picks — the board opens on them when the browser holds none.
const recorded = existsSync(join(here, 'picks.json')) ? JSON.parse(read('picks.json')) : { picks: {}, notes: {} }
const data = Object.fromEntries(APPS.map((a) => [a.key, Object.fromEntries(candidatesFor(a.key).map((c) => [c.id, c.src]))]))

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tooling icons — working board</title>
<style>
  :root { --bg:#f6f5f1; --surface:#fff; --text:#1b1b1d; --muted:#6a6a70; --border:#dcdad3; --accent:#9a7b00; --pick:#e8c547; --tab-light:#f1f3f4; --tab-dark:#202124; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121214; --surface:#1c1c1f; --text:#ececee; --muted:#9a9aa2; --border:#2e2e33; --accent:#e8c547; } }
  * { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--text); font:15px/1.45 system-ui, sans-serif; }
  main { max-width:1100px; margin:0 auto; padding:24px 16px 80px; }
  h1 { font-size:24px; margin:0 0 4px; } .sub { color:var(--muted); margin:0 0 16px; }
  .family { position:sticky; top:0; z-index:2; background:var(--bg); padding:8px 0 12px; border-bottom:1px solid var(--border); margin-bottom:16px; }
  .strip { display:flex; align-items:center; gap:10px; padding:8px 12px; border-radius:8px; margin-top:6px; flex-wrap:wrap; }
  .strip.light { background:var(--tab-light); } .strip.dark { background:var(--tab-dark); }
  .strip .sep { width:1px; align-self:stretch; background:#8888; margin:0 4px; } .strip .hole { border-radius:22%; outline:1px dashed #8888; display:inline-block; }
  .bar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; color:var(--muted); font-size:13px; }
  button { font:inherit; padding:6px 12px; border-radius:6px; border:1px solid var(--border); background:var(--surface); color:var(--text); cursor:pointer; }
  .app { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:16px; }
  .app h2 { margin:0; font-size:18px; } .blurb, .meta { color:var(--muted); margin:2px 0; font-size:13px; } .lean { margin:6px 0 12px; font-size:14px; color:var(--accent); }
  a { color:inherit; }
  .cols { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:12px; }
  .col { border:2px solid var(--border); border-radius:8px; padding:12px; display:block; } .col h3 { margin:0 0 10px; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
  .cand, .skip { cursor:pointer; } .col:has(input:checked) { border-color:var(--pick); box-shadow:0 0 0 2px var(--pick) inset; } .skip { align-self:start; }
  .big { display:block; margin-bottom:10px; } .ladder { display:flex; align-items:center; gap:10px; padding:6px 10px; border-radius:6px; margin-bottom:6px; }
  .ladder.light { background:var(--tab-light); } .ladder.dark { background:var(--tab-dark); }
  .none { color:var(--muted); font-style:italic; padding:24px 0; } .file { font-family:ui-monospace, monospace; font-size:12px; }
  .chip { display:inline-block; padding:1px 8px; border-radius:99px; font-size:12px; font-weight:700; text-transform:uppercase; }
  .chip.pass { background:#1f7a3a; color:#fff; } .chip.warn { background:#b7791f; color:#fff; } .chip.fail { background:#b91c1c; color:#fff; } .chip.unmeasured { background:#666; color:#fff; }
  textarea { width:100%; margin-top:12px; font:inherit; padding:8px; border-radius:6px; border:1px solid var(--border); background:var(--bg); color:var(--text); resize:vertical; }
</style></head><body><main>
<h1>Tooling icons — working board</h1>
<p class="sub">Ten apps, each with the icon it ships today beside the candidates from Todd's hand-off (2026-09-20). Pick one per app; the strip below shows the family as browser tabs will. Picks and notes stay in this browser.</p>
<div class="family">
  <strong>The family with your picks</strong> <span class="sub">— the three shipping marks, then the ten</span>
  ${['light', 'dark'].map((t) => `<div class="strip ${t}">${[32, 16].map((s) => `${shipping.map((m) => `<img src="${m.src}" width="${s}" height="${s}" alt="${m.name}" title="${m.name}">`).join('')}<span class="sep"></span>${APPS.map((a) => `<img data-family="${a.key}" width="${s}" height="${s}" alt="" title="${a.name}">`).join('')}`).join('<span class="sep"></span>')}</div>`).join('')}
  <div class="bar"><span id="count"></span><button id="lean">Apply the hand-off's leans</button><button id="copy">Copy picks + notes</button><button id="clear">Back to the recorded picks</button></div>
</div>
${rows}
</main>
<script>
const MARKS = ${JSON.stringify(data)};
const LEANS = { lien:'lien-2', paper:'paper-2', pay:'pay-2', sub:'sub-2', sync:'sync-2', connect:'connect-2', gov:'gov-2' };
const KEY = 'tooling-icons-board-v1';
const RECORDED = ${JSON.stringify({ picks: recorded.picks, notes: recorded.notes })};
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || structuredClone(RECORDED) } catch { return structuredClone(RECORDED) } };
let state = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)) } catch {} window.__toolingIconBoard = state; };
function paint() {
  for (const app of Object.keys(MARKS)) {
    const pick = state.picks[app];
    document.querySelectorAll('input[name="pick-' + app + '"]').forEach((i) => { i.checked = i.value === pick });
    document.querySelectorAll('img[data-family="' + app + '"]').forEach((img) => {
      const src = pick && pick !== 'skip' ? MARKS[app][pick] : null;
      if (src) { img.src = src; img.className = ''; img.style.visibility = 'visible' }
      else { img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='; img.className = 'hole'; img.style.visibility = pick === 'skip' ? 'hidden' : 'visible' }
    });
  }
  document.querySelectorAll('textarea[data-note]').forEach((t) => { if (document.activeElement !== t) t.value = state.notes[t.dataset.note] || '' });
  const n = Object.values(state.picks).filter(Boolean).length;
  document.getElementById('count').textContent = n + ' of ' + Object.keys(MARKS).length + ' decided';
}
document.addEventListener('change', (e) => { const m = /^pick-(.+)$/.exec(e.target.name || ''); if (m) { state.picks[m[1]] = e.target.value; save(); paint() } });
document.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.note; if (k) { state.notes[k] = e.target.value; save() } });
document.getElementById('lean').onclick = () => { state.picks = { ...LEANS, ...state.picks }; save(); paint() };
document.getElementById('clear').onclick = () => { state = structuredClone(RECORDED); save(); paint() };
document.getElementById('copy').onclick = async () => {
  const text = Object.keys(MARKS).map((a) => a + ': ' + (state.picks[a] || '—') + (state.notes[a] ? '  // ' + state.notes[a] : '')).join('\\n');
  try { await navigator.clipboard.writeText(text); document.getElementById('copy').textContent = 'Copied' } catch { prompt('Picks', text) }
};
save(); paint();
</script>
</body></html>
`
writeFileSync(join(here, 'board.html'), html)
console.log(`board.html: ${APPS.length} apps, ${files.length} candidates, ${Math.round(html.length / 1024)} KB`)
