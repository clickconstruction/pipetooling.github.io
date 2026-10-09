/**
 * Generates the iOS home-screen (web clip) icons — public/apple-touch-icon.png (1024) and the
 * exact-size renders beside it (180 / 167 / 152 / 120) — from the app mark in public/favicon.svg.
 *
 * Deliberate departures from the SVG, all for iOS 26's Liquid Glass, which is composited over
 * every flat web-clip icon (native apps ship layered icons, so the glass sits above their art):
 *   - Full-bleed, square corners: iOS masks the tile itself; a transparent corner renders black.
 *   - The mark is pulled in from the edges (MARK_SCALE 0.62 of the tile instead of the SVG's
 *     0.72) — the lens band along the lower edge lifts dark ink there to grey and smears its
 *     edge; at 0.62 the bottom tooth sits 17% out (v2.4095).
 *   - The mark is centred on the tile by its OWN centre (MARK_CENTRE): the gear is drawn in a
 *     640-unit space around (320, 320), so the inset is 256 − 320·s, not (512 − 512·s)/2 (v2.4158).
 *   - Heavier art (v2.4227): the ink is pure black (the favicon's #161617 went muddy grey under
 *     the glass) and the wrench cutout is stroked in the tile colour so its thin edges are not
 *     what the glass smears. The favicon and the CountTooling / Takeoff Tooling marks keep theirs.
 *   - Exact sizes (v2.4227): iOS downsampled the 1024 itself, about 5.7× for a phone; each size
 *     Apple asks for is rendered from the SVG at that size and linked with `sizes` in index.html.
 *     The 1024 stays at /apple-touch-icon.png as the unsized fallback — the help share-card shell
 *     and the portal link shell point at that name.
 *   - The tile and the mark are options (v2.5097): TILE picks the tile and the mark's colour
 *     (TILES), MARK the mark's weight (MARKS). With neither set the output is v2.4227's, byte for
 *     byte. `--sheet` renders all nine pairs at 180 px with the glass approximated, for the owner
 *     to pick from, into to-dos/app-icon-glass-candidates.{html,png}; it leaves public/ alone.
 *
 * Rendered with the Chromium that @playwright/test already installs for the e2e suite. Re-run with:
 *   npm run gen-app-icon                              the touch icons (TILE=yellow MARK=now)
 *   TILE=dark MARK=heavier npm run gen-app-icon       the touch icons from a sheet pick
 *   npm run gen-app-icon -- --sheet                   the candidate sheet only
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Apple's icon canvas first (App Library, Spotlight, the unsized fallback), then the web-clip sizes. */
const SIZES = [1024, 180, 167, 152, 120]
const MARK_SCALE = 0.62
const SVG_BOX = 512
/** The mark's own centre: the gear path lives in a 640-unit space around (320, 320). */
const MARK_CENTRE = 320
/** The SVG's rounded yellow tile; the touch icon is full-bleed in the TILE colour. */
const SVG_TILE = '<rect width="512" height="512" rx="112" fill="#e8c547"/>'
/** The SVG's own placement of the mark: translate(256 − 320·s) scale(s) at s = 0.72 → 25.60. */
const SVG_MARK_TRANSFORM = 'transform="translate(25.60 25.60) scale(0.7200)"'
/** The favicon's ink (the gear body and hub); the touch icon paints it in the TILE's ink. */
const SVG_INK = 'fill="#161617"'
/** The gear path's close and fill, just before the hub — where MARK=heavier adds its stroke. */
const SVG_GEAR_END = 'z" fill="#161617"/><circle'
/** The solid hub over the gear's round hole; MARK=simpler drops it with the wrench. */
const SVG_HUB = '<circle cx="320" cy="320" r="96" fill="#161617"/>'
/** The wrench group's opening tag; MARK=simpler cuts from here through its closing </g>. */
const SVG_WRENCH_OPEN = '<g transform="translate(320 320) rotate(45) scale(0.75) translate(-416 -224)">'
/** The wrench cutout's fill — the last path in the file — stroked in the tile colour to fatten it. */
const SVG_WRENCH_FILL = 'fill="#e8c547"/></g></g>'
/** In the wrench's own 512-unit space (≈0.93 px per unit on the 1024 tile, ≈0.16 at 180). */
const WRENCH_STROKE = 20

/** The tile colour and the mark's colour. The wrench is cut in the tile colour. */
const TILES = {
  /** The tile CountTooling and Takeoff Tooling share, the ink pure black (v2.4227). */
  yellow: { label: 'Yellow tile', tile: '#e8c547', ink: '#000000' },
  /** Near-black (the favicon's ink) with the gear in the yellow: native icons wear the glass best dark. */
  dark: { label: 'Dark tile, yellow mark', tile: '#161617', ink: '#e8c547' },
  /** The lighter mark on dark: white keeps the most contrast once the glass lifts the tile. */
  'dark-white': { label: 'Dark tile, white mark', tile: '#161617', ink: '#ffffff' },
}
/** The mark's weight. `gearStroke` is in the gear's 640-unit space (≈0.22 px per unit at 180). */
const MARKS = {
  now: { label: 'As now', note: 'the gear, the hub and the fat wrench (v2.4227)' },
  heavier: { label: 'Heavier ink', note: 'the gear’s edge thickened, so its teeth are fatter', gearStroke: 24 },
  simpler: { label: 'Simpler mark', note: 'the gear alone, with its own round hole', gearOnly: true },
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'public', 'favicon.svg')
const outPath = (size) =>
  join(root, 'public', size === 1024 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}.png`)
const SHEET_HTML = join(root, 'to-dos', 'app-icon-glass-candidates.html')
const SHEET_PNG = join(root, 'to-dos', 'app-icon-glass-candidates.png')

const source = readFileSync(svgPath, 'utf8')
for (const [name, needle] of [
  ['SVG_TILE', SVG_TILE],
  ['SVG_MARK_TRANSFORM', SVG_MARK_TRANSFORM],
  ['SVG_INK', SVG_INK],
  ['SVG_GEAR_END', SVG_GEAR_END],
  ['SVG_HUB', SVG_HUB],
  ['SVG_WRENCH_OPEN', SVG_WRENCH_OPEN],
  ['SVG_WRENCH_FILL', SVG_WRENCH_FILL],
]) {
  if (!source.includes(needle)) throw new Error(`favicon.svg no longer carries ${needle}; update ${name}`)
}

/**
 * favicon.svg rewritten as the touch-icon art for one tile and one mark. The ink is painted
 * before the tile and the wrench take their colour: the dark tile is the favicon's own ink.
 */
function touchArt(tile, mark) {
  const inset = (SVG_BOX / 2 - MARK_CENTRE * MARK_SCALE).toFixed(2)
  let art = source.replace(
    SVG_MARK_TRANSFORM,
    `transform="translate(${inset} ${inset}) scale(${MARK_SCALE.toFixed(4)})"`,
  )
  if (mark.gearStroke) {
    art = art.replace(
      SVG_GEAR_END,
      `z" fill="#161617" stroke="${tile.ink}" stroke-width="${mark.gearStroke}" stroke-linejoin="round"/><circle`,
    )
  }
  if (mark.gearOnly) {
    const start = art.indexOf(SVG_WRENCH_OPEN)
    art = art.slice(0, start) + art.slice(art.indexOf('</g>', start) + '</g>'.length)
    art = art.replace(SVG_HUB, '')
  }
  art = art
    .replaceAll(SVG_INK, `fill="${tile.ink}"`)
    .replace(SVG_TILE, `<rect width="512" height="512" rx="0" fill="${tile.tile}"/>`)
  if (mark.gearOnly) return art
  return art.replace(
    SVG_WRENCH_FILL,
    `fill="${tile.tile}" stroke="${tile.tile}" stroke-width="${WRENCH_STROKE}" stroke-linejoin="round"/></g></g>`,
  )
}

async function renderPng(browser, art, size) {
  const sized = art.replace('<svg ', `<svg width="${size}" height="${size}" `)
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(
    `<body style="margin:0"><div id="tile" style="width:${size}px;height:${size}px">${sized}</div></body>`,
  )
  const png = await page.locator('#tile').screenshot({ type: 'png', omitBackground: false })
  await page.close()
  return png
}

function pick(table, name, envName) {
  const entry = table[name]
  if (!entry) throw new Error(`${envName}=${name} is not one of ${Object.keys(table).join(', ')}`)
  return entry
}

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The candidate sheet. Every icon is the 180 px file the phone asks for, shown at 90 CSS px
 * (1:1 on the 2× sheet PNG) and at 60 CSS px on the home-screen panels (1:1 on a 3× iPhone).
 * The glass is a CSS stand-in for what the phone does to a flat web clip: a white lift that turns
 * dark ink grey, a slight softening of every edge, a lens band along the bottom that blurs and
 * lifts more, and a bright rim. It is an approximation; a photo of the phone decides.
 */
function sheetHtml(candidates, date) {
  const glass = (c, size) =>
    `<div class="glass" style="--s:${size}px"><i class="art icon-${c.letter}" role="img" aria-label="${c.letter}"></i><i class="band"></i><i class="lift"></i><i class="rim"></i></div>`
  const flat = (c) => `<div class="flat"><i class="art icon-${c.letter}" role="img" aria-label="${c.letter}"></i></div>`
  const homeScreen = (theme) => `
    <div class="wall wall-${theme}">
      ${Object.keys(TILES)
        .map(
          (tileName) => `<div class="wall-row">${candidates
            .filter((c) => c.tileName === tileName)
            .map((c) => `<figure>${glass(c, 60)}<figcaption>${c.letter}</figcaption></figure>`)
            .join('')}</div>`,
        )
        .join('')}
    </div>`
  const card = (c) => `
    <article class="card">
      <header><b class="letter">${c.letter}</b><div><h3>${escapeHtml(c.markLabel)}</h3><p>${escapeHtml(c.markNote)}</p></div></header>
      <div class="trio">
        <figure>${flat(c)}<figcaption>The file</figcaption></figure>
        <figure><div class="pad pad-light">${glass(c, 90)}</div><figcaption>Glass, light wallpaper</figcaption></figure>
        <figure><div class="pad pad-dark">${glass(c, 90)}</div><figcaption>Glass, dark wallpaper</figcaption></figure>
      </div>
      <code>TILE=${c.tileName} MARK=${c.markName}</code>
    </article>`
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Home-screen icon candidates</title>
<!-- Generated by scripts/generate-app-icon.mjs --sheet (npm run gen-app-icon -- --sheet). Do not hand-edit. -->
<style>
  :root {
    --ground: #F3F4F6; --surface: #FFFFFF; --ink: #111827; --muted: #6B7280; --line: #E5E7EB;
    --wall-light: #CDD4DF; --wall-dark: #181C25;
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 14px/1.5 -apple-system, "Segoe UI", system-ui, sans-serif; padding: 0 16px 40px; }
  .wrap { max-width: 1120px; margin: 0 auto; }
  header.top { padding: 26px 0 12px; border-bottom: 2px solid var(--ink); display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap; align-items: flex-end; }
  .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 4px; }
  h1 { margin: 0; font-size: 26px; line-height: 1.15; }
  .stamp { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: var(--muted); text-align: right; line-height: 1.6; }
  .lede { max-width: 72ch; margin: 14px 0 0; }
  h2 { font-size: 17px; margin: 28px 0 4px; }
  h2 + p { margin: 0 0 12px; color: var(--muted); max-width: 72ch; }
  figure { margin: 0; text-align: center; }
  figcaption { font-size: 11px; color: var(--muted); margin-top: 6px; }
  .walls { display: flex; gap: 16px; flex-wrap: wrap; }
  .wall { flex: 1 1 300px; border-radius: 22px; padding: 22px 18px 14px; display: grid; gap: 14px; }
  .wall-light, .pad-light { background: var(--wall-light); }
  .wall-dark, .pad-dark { background: var(--wall-dark); }
  .wall-row { display: flex; justify-content: space-around; }
  .wall figcaption { font-size: 12px; font-weight: 600; margin-top: 5px; }
  .wall-light figcaption { color: #1F2937; }
  .wall-dark figcaption { color: #F9FAFB; }
  .rowlabels { display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
  .tilehead { grid-column: 1 / -1; font-size: 13px; font-weight: 700; margin: 10px 0 -4px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .card header { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 10px; }
  .letter { font-size: 22px; line-height: 1; width: 34px; height: 34px; border-radius: 8px; background: var(--ink); color: var(--surface); display: grid; place-items: center; flex: none; }
  .card h3 { margin: 0; font-size: 14px; }
  .card p { margin: 0; font-size: 12px; color: var(--muted); }
  .trio { display: flex; justify-content: space-between; gap: 8px; }
  .flat, .pad { width: 100px; height: 100px; display: grid; place-items: center; border-radius: 10px; }
  .flat { background: repeating-conic-gradient(#E5E7EB 0 25%, #FFFFFF 0 50%) 0 0 / 12px 12px; }
  .flat .art { width: 90px; height: 90px; }
  .card code { display: block; margin-top: 10px; font-size: 11px; color: var(--muted); }
  /* The approximated glass. Every length scales with --s so the 60 and 90 px tiles match. */
  .glass { --s: 90px; position: relative; width: var(--s); height: var(--s); border-radius: calc(var(--s) * .2237); overflow: hidden; margin: 0 auto;
    box-shadow: 0 calc(var(--s) * .012) calc(var(--s) * .035) rgba(0,0,0,.28), 0 calc(var(--s) * .05) calc(var(--s) * .14) rgba(0,0,0,.16); }
  .glass .art { filter: blur(calc(var(--s) * .0042)); }
  .glass i { position: absolute; inset: 0; display: block; }
  .glass .band { top: auto; height: 24%; backdrop-filter: blur(calc(var(--s) * .016)) brightness(1.22) saturate(.85);
    -webkit-mask-image: linear-gradient(to top, #000 50%, transparent); mask-image: linear-gradient(to top, #000 50%, transparent); }
  .glass .lift { background: linear-gradient(165deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,.11) 36%, rgba(255,255,255,.07) 64%, rgba(255,255,255,.15) 100%); }
  .glass .rim { border-radius: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,.70), inset 1px 0 0 rgba(255,255,255,.35), inset 0 -1px 0 rgba(255,255,255,.32), inset -1px 0 0 rgba(255,255,255,.18); }
  /* Each 180 px file once; every tile that shows it draws it at its own size. */
  .art { display: block; background: center / 100% 100% no-repeat; }
${candidates.map((c) => `  .icon-${c.letter} { background-image: url(${c.uri}); }`).join('\n')}
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--muted); max-width: 80ch; }
  footer p { margin: 0 0 6px; }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <p class="eyebrow">Punch list #67 · PR 2 · for the owner to pick</p>
      <h1>The home-screen icon: pick one of nine</h1>
    </div>
    <div class="stamp">${date}<br>scripts/generate-app-icon.mjs --sheet</div>
  </header>
  <p class="lede">Each icon is the 180 px file an iPhone asks for. iOS 26 lays its glass over every icon saved from a web page, and that glass is what made A look rough. The glass here is drawn by this page, so it is a close guess and not the phone itself. Say the letter you like. The next PR makes the real icons from it.</p>

  <h2>All nine on a home screen</h2>
  <p>At the size the phone shows them. Open this page on an iPhone and these are one to one with the home screen. Rows top to bottom: ${Object.values(TILES)
    .map((t) => t.label.toLowerCase())
    .join(' · ')}.</p>
  <div class="walls">${homeScreen('light')}${homeScreen('dark')}</div>

  <h2>Each one up close</h2>
  <p>Half again as big as the phone shows them. The file is the icon as saved. The two on the right are the same file under the drawn glass.</p>
  <div class="grid">
    ${Object.entries(TILES)
      .map(
        ([tileName, t]) =>
          `<div class="tilehead">${escapeHtml(t.label)}</div>` +
          candidates
            .filter((c) => c.tileName === tileName)
            .map(card)
            .join(''),
      )
      .join('')}
  </div>

  <footer>
    <p>The drawn glass: a white lift over the whole tile, every edge softened a little, a band along the bottom that blurs and lifts more, and a bright rim. The phone does more than this. A photo of the real home screen decides.</p>
    <p>Ten-second check on any iOS 26 phone: Settings, Accessibility, Display &amp; Text Size, Reduce Transparency. If the icon snaps crisp, it is the glass. Turn it back off after.</p>
    <p>A is the icon live since v2.4227. The favicon and the CountTooling and Takeoff Tooling marks do not change with this pick.</p>
  </footer>
</div>
</body>
</html>
`
}

const browser = await chromium.launch()
try {
  if (process.argv.includes('--sheet')) {
    const candidates = []
    let letter = 'A'.charCodeAt(0)
    for (const [tileName, tile] of Object.entries(TILES)) {
      for (const [markName, mark] of Object.entries(MARKS)) {
        const png = await renderPng(browser, touchArt(tile, mark), 180)
        candidates.push({
          letter: String.fromCharCode(letter++),
          tileName,
          markName,
          markLabel: mark.label,
          markNote: mark.note,
          uri: `data:image/png;base64,${png.toString('base64')}`,
        })
      }
    }
    const date = new Date().toISOString().slice(0, 10)
    writeFileSync(SHEET_HTML, sheetHtml(candidates, date))
    const page = await browser.newPage({ viewport: { width: 1152, height: 900 }, deviceScaleFactor: 2 })
    await page.goto(`file://${SHEET_HTML}`)
    writeFileSync(SHEET_PNG, await page.screenshot({ type: 'png', fullPage: true }))
    await page.close()
    console.log(`Wrote ${SHEET_HTML} and ${SHEET_PNG} (${candidates.length} candidates at 180 px)`)
  } else {
    const tileName = process.env.TILE ?? 'yellow'
    const markName = process.env.MARK ?? 'now'
    const art = touchArt(pick(TILES, tileName, 'TILE'), pick(MARKS, markName, 'MARK'))
    for (const size of SIZES) {
      const png = await renderPng(browser, art, size)
      writeFileSync(outPath(size), png)
      console.log(
        `Wrote ${outPath(size)} (${png.length} bytes, ${size}x${size}, TILE=${tileName} MARK=${markName}, mark at ${MARK_SCALE} of the tile)`,
      )
    }
  }
} finally {
  await browser.close()
}
