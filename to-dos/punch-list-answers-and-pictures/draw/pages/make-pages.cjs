// Makes the pictures page beside each punch-list card, and the index page, from cards.json and a folder of
// WebP pictures (punch list #438). The pictures are not in the repo as files: each page carries its own.
// Draw them again with the kit one folder up, convert each PNG with `cwebp -q 80 -m 6`, then run from the repo root:
//   node to-dos/punch-list-answers-and-pictures/draw/pages/make-pages.cjs <folder of .webp pictures> [--card <number>]
// With --card it writes that one card's page and leaves the rest, so the folder needs that card's pictures alone.
// Each card in cards.json says the day its pictures were drawn (`drawn`) and the newest version main held that
// day (`drawnAt`). The page says both, and the board reads them: a card that cites a newer version than its
// pictures were drawn at is marked as changed since (`picturesAreStale` in src/lib/todos/todoBoard.ts).
// To change only a page's words, edit the page itself: the words are plain HTML above the pictures.
const fs = require('fs')
const path = require('path')
const HERE = __dirname
const REPO = path.resolve(HERE, '../../../..')
const WEBP = process.argv[2]
if (!WEBP || !fs.existsSync(WEBP)) throw new Error('pass the folder that holds the .webp pictures')
const CARDS = JSON.parse(fs.readFileSync(path.join(HERE, 'cards.json'), 'utf8'))
const ONLY = process.argv.includes('--card') ? Number(process.argv[process.argv.indexOf('--card') + 1]) : null
if (ONLY !== null && !CARDS.some((c) => c.number === ONLY)) throw new Error(`cards.json holds no card #${ONLY}`)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** `2026-11-24` -> `24 November 2026`. */
const longDay = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}` }

const HOME = 'punch-list-answers-and-pictures'
const GROUPS = []
for (const c of CARDS) {
  const g = GROUPS.find((x) => x.title === c.group) || GROUPS[GROUPS.push({ title: c.group, cards: [] }) - 1]
  g.cards.push(c.number)
}
const WHERE = Object.fromEntries(CARDS.map((c) => [c.number, c.where]))
// Where each card lives: a folder card takes pictures.html, a flat card a top-level page named after it.
const pageOf = (n) => (WHERE[n].endsWith('.md') ? `to-dos/${WHERE[n].slice(0, -3)}-pictures.html` : `to-dos/${WHERE[n]}/pictures.html`)

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const rich = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*([^*]+)\*/g, '<em>$1</em>')

const KIND = {
  app: { label: 'The app, invented data', cls: 'k-app' },
  harness: { label: 'The real component on a harness', cls: 'k-harness' },
  mockup: { label: "The card's mock-up", cls: 'k-mock' },
}

const card = (n) => { const c = CARDS.find((x) => x.number === n); return { calls: [], say: [], ...c } }

let bytes = 0
function figure(p) {
  const { w, h } = p
  const data = fs.readFileSync(path.join(WEBP, p.file))
  bytes += data.length
  const src = `data:image/webp;base64,${data.toString('base64')}`
  const k = KIND[p.kind] || KIND.app
  const phone = p.width ? p.width === 'phone' : w / h < 0.8
  const basis = phone ? (h / w > 1.5 ? 250 : Math.min(Math.round(w / 2), 374)) : null
  const style = phone ? ` style="flex-basis:${basis}px;max-width:${basis}px"` : w < 1100 ? ` style="max-width:${w}px"` : ''
  const meta = [p.role, p.width === 'phone' ? 'phone' : p.width === 'desk' ? 'desk' : null, p.theme === 'dark' ? 'dark' : null].filter(Boolean).join(' · ')
  const notBuilt = p.not_built ? '<span class="chip k-warn">Not built</span>' : ''
  const rows = p.kind === 'app' && p.rows === 'supplied' ? '<span class="plus" title="Invented rows were handed to the sealed frame for this picture">+ rows</span>' : ''
  return `<figure class="pic ${phone ? 'is-phone' : 'is-desk'}"${style}>
<div class="pic-top"><span class="chip ${k.cls}">${k.label}</span>${rows}${notBuilt}<span class="pic-meta">${esc(meta)}</span></div>
<button type="button" class="pic-frame" aria-label="Enlarge: ${esc(p.caption)}"><img src="${src}" width="${w}" height="${h}" loading="lazy" alt="${esc(p.caption)}"></button>
<figcaption>${rich(p.caption)}</figcaption>
</figure>`
}

function answerBlock(c) {
  const say = c.say.length ? `<ul class="say">${c.say.map((s) => `<li><q>${rich(s)}</q></li>`).join('')}</ul>` : ''
  return `<section class="answer"><h2>Still to answer</h2><p class="waits">${rich(c.waits)}</p>${say ? `<h3>You can say</h3>${say}` : ''}</section>`
}

function cardPage(c) {
  const facts = []
  if (c.stands) facts.push(`<div class="fact"><h3>Where it stands</h3><p>${rich(c.stands)}</p></div>`)
  if (c.stale) facts.push(`<div class="fact"><h3>The stale next line</h3><dl><dt>The card says</dt><dd>${rich(c.stale.says)}</dd><dt>True on main, 2026-11-24</dt><dd>${rich(c.stale.truth)}</dd><dt>The fix</dt><dd>${rich(c.stale.fix)}</dd></dl></div>`)
  if (c.calls.length) facts.push(`<div class="fact"><h3>${esc(c.calls_title || 'The calls, each with its pick')}</h3><ul class="calls">${c.calls.map((x) => `<li><span class="call">${rich(x.call)}</span><span class="pick">${rich(x.pick)}</span></li>`).join('')}</ul></div>`)
  if (c.extra) facts.push(`<div class="fact"><h3>${esc(c.extra.title)}</h3><ul class="calls">${c.extra.items.map((x) => `<li><span class="pick">${rich(x)}</span></li>`).join('')}</ul></div>`)
  const notes = []
  if (c.differs) notes.push(`<p class="note"><strong>Differs from the card.</strong> ${rich(c.differs)}</p>`)
  if (c.could_not) notes.push(`<p class="note couldnot"><strong>Not pictured.</strong> ${rich(c.could_not)}</p>`)
  const phones = c.pictures.filter((p) => p.width === 'phone')
  const desks = c.pictures.filter((p) => p.width !== 'phone')
  const order = c.pictures[0].width === 'phone' ? [phones, desks] : [desks, phones]
  const pics = order.map((l) => (l.length ? `<div class="pics">${l.map(figure).join('\n')}</div>` : '')).join('\n')
  const up = WHERE[c.number].endsWith('.md') ? '' : '../'
  return page(`#${c.number} pictures: ${c.short || c.name}`, `
<header class="top">
<p class="eyebrow">Punch list #${c.number} · the built screen, drawn with invented data · ${longDay(c.drawn)}</p>
<h1>${rich(c.name)}</h1>
<p class="lede">${rich(c.what)}</p>
<p class="back"><a href="${up}${HOME}/waiting-2026-11-24.html">All fifteen cards that waited on a person that day</a></p>
</header>
${answerBlock(c)}
<section class="facts">${facts.join('\n')}</section>
<section class="gallery"><h2>What it looks like</h2>
${notes.join('\n')}
${pics}
</section>
${LEGEND}
<footer class="foot"><p>Drawn ${c.drawn} with main at ${c.drawnAt}. Every person, job, customer and amount is invented. The app ran on a local server in the lens frame (punch list #194), which swaps the database for an invented company before the app starts. The live site was not opened and nothing was written. How to draw them again: <code>to-dos/${HOME}/how-the-pictures-were-drawn.md</code>.</p></footer>`, c)
}

const LEGEND = `<section class="legend" aria-label="What each picture label means">
<div><span class="chip k-app">The app, invented data</span><p>The real app in the lens frame. <span class="plus">+ rows</span> marks a picture where invented rows were handed to the sealed frame, because its own invented company holds none for that screen.</p></div>
<div><span class="chip k-mock">The card's mock-up</span><p>The drawing the card was built from, shot as it is. It is not the built screen.</p></div>
</section>`

const CSS = fs.readFileSync(path.join(HERE, 'cardpage.css'), 'utf8')
const JS = `(function(){var box=document.getElementById('lightbox');var big=box.querySelector('img');document.addEventListener('click',function(e){var f=e.target.closest?e.target.closest('.pic-frame'):null;if(f){var i=f.querySelector('img');big.src=i.src;big.alt=i.alt;if(box.showModal)box.showModal();return}if(e.target===box)box.close()})})()`

function page(title, body, made = { drawn: '2026-11-24', drawnAt: 'v2.8442' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<!-- Made by a script on ${made.drawn} (punch list #438), with main at ${made.drawnAt}. Every name, job and amount is invented.
     To change the words or redraw a picture, see to-dos/${HOME}/how-the-pictures-were-drawn.md. -->
<style>
${CSS}
</style>
</head>
<body>
<div class="wrap">
${body}
</div>
<dialog id="lightbox" aria-label="Enlarged picture"><form method="dialog"><button class="lb-close">Close</button></form><img alt=""></dialog>
<script>${JS}</script>
</body>
</html>
`
}

const cards = {}
const written = []
for (const g of GROUPS) for (const n of g.cards) {
  const c = (cards[n] = card(n))
  if (ONLY !== null && n !== ONLY) continue
  const before = bytes
  const html = cardPage(c)
  const file = path.join(REPO, pageOf(n))
  fs.writeFileSync(file, html)
  written.push(`${pageOf(n)} ${(html.length / 1000).toFixed(0)} KB, ${c.pictures.length} pictures, ${((bytes - before) / 1000).toFixed(0)} KB of webp`)
}

// The index: every card that waited on a person, what it waits on and what to say, with a door to its pictures.
const rows = GROUPS.map((g) => `<section class="group"><h2>${esc(g.title)}</h2>
${g.cards.map((n) => {
  const c = cards[n]
  const href = '../' + pageOf(n).slice('to-dos/'.length)
  const say = c.say.length ? `<ul class="say">${c.say.map((s) => `<li><q>${rich(s)}</q></li>`).join('')}</ul>` : ''
  return `<article class="row" id="c${n}">
<div class="num"><span>#</span>${n}</div>
<div class="row-main"><h3><a href="${href}">${rich(c.name)}</a></h3><p class="what">${rich(c.what)}</p>
<p class="waits"><strong>Waits on.</strong> ${rich(c.waits)}</p>${say}
<p class="door"><a href="${href}">See its ${c.pictures.length} pictures</a></p></div>
</article>`
}).join('\n')}
</section>`).join('\n')

const index = page('Still to answer, 24 November 2026', `
<header class="top">
<p class="eyebrow">Punch list #438 · a snapshot of 24 November 2026</p>
<h1>Fifteen cards, built and waiting on a person</h1>
<p class="lede">Each card here was built, or nearly, and waited on a person on that day. For each: what it waits on, what to say to move it, and a door to pictures of its screen drawn with invented data. A card's own front matter is the truth today. This page is the day it was drawn.</p>
</header>
${rows}
<footer class="foot"><p>Made 2026-11-24 from main at 68e9244. Card #430 was the sixteenth and was closed the same day. The page is static: it does not follow the cards as they change.</p></footer>`)
// The index is the snapshot of 2026-11-24. A redraw of one card leaves it as it is.
if (ONLY === null) fs.writeFileSync(path.join(REPO, 'to-dos', HOME, 'waiting-2026-11-24.html'), index)
console.log(written.join('\n'))
console.log('index', (index.length / 1000).toFixed(0), 'KB; webp total', (bytes / 1e6).toFixed(2), 'MB')
