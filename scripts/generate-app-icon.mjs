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
 *     the glass) and the wrench cutout is stroked in the tile yellow so its thin edges are not
 *     what the glass smears. The favicon and the CountTooling / Takeoff Tooling marks keep theirs.
 *   - Exact sizes (v2.4227): iOS downsampled the 1024 itself, about 5.7× for a phone; each size
 *     Apple asks for is rendered from the SVG at that size and linked with `sizes` in index.html.
 *     The 1024 stays at /apple-touch-icon.png as the unsized fallback — the help share-card shell
 *     and the portal link shell point at that name.
 *
 * Rendered with the Chromium that @playwright/test already installs for the e2e suite. Re-run with:
 *   npm run gen-app-icon
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
/** The SVG's own placement of the mark: translate(256 − 320·s) scale(s) at s = 0.72 → 25.60. */
const SVG_MARK_TRANSFORM = 'transform="translate(25.60 25.60) scale(0.7200)"'
/** The favicon's ink (the gear body and hub); the touch icon paints it pure black. */
const SVG_INK = 'fill="#161617"'
const TOUCH_INK = 'fill="#000000"'
/** The wrench cutout's fill — the last path in the file — stroked in the same yellow to fatten it. */
const SVG_WRENCH_FILL = 'fill="#e8c547"/></g></g>'
/** In the wrench's own 512-unit space (≈0.93 px per unit on the 1024 tile, ≈0.16 at 180). */
const WRENCH_STROKE = 20

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '..', 'public', 'favicon.svg')
const outPath = (size) =>
  join(__dirname, '..', 'public', size === 1024 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}.png`)

const source = readFileSync(svgPath, 'utf8')
for (const [name, needle] of [
  ['SVG_MARK_TRANSFORM', SVG_MARK_TRANSFORM],
  ['SVG_INK', SVG_INK],
  ['SVG_WRENCH_FILL', SVG_WRENCH_FILL],
]) {
  if (!source.includes(needle)) throw new Error(`favicon.svg no longer carries ${needle}; update ${name}`)
}
const inset = (SVG_BOX / 2 - MARK_CENTRE * MARK_SCALE).toFixed(2)
const art = source
  .replace('rx="112"', 'rx="0"')
  .replace(SVG_MARK_TRANSFORM, `transform="translate(${inset} ${inset}) scale(${MARK_SCALE.toFixed(4)})"`)
  .replaceAll(SVG_INK, TOUCH_INK)
  .replace(
    SVG_WRENCH_FILL,
    `fill="#e8c547" stroke="#e8c547" stroke-width="${WRENCH_STROKE}" stroke-linejoin="round"/></g></g>`,
  )

const browser = await chromium.launch()
try {
  for (const size of SIZES) {
    const sized = art.replace('<svg ', `<svg width="${size}" height="${size}" `)
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.setContent(
      `<body style="margin:0"><div id="tile" style="width:${size}px;height:${size}px">${sized}</div></body>`,
    )
    const png = await page.locator('#tile').screenshot({ type: 'png', omitBackground: false })
    writeFileSync(outPath(size), png)
    console.log(`Wrote ${outPath(size)} (${png.length} bytes, ${size}x${size}, mark at ${MARK_SCALE} of the tile)`)
    await page.close()
  }
} finally {
  await browser.close()
}
