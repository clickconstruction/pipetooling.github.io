/**
 * Generates public/apple-touch-icon.png — the iOS home-screen (web clip) icon — from the
 * app mark in public/favicon.svg.
 *
 * Two deliberate departures from the SVG (v2.4095):
 *   - Full-bleed, square corners: iOS masks the tile itself; a transparent corner renders black.
 *   - The mark is pulled in from the edges (MARK_SCALE 0.62 of the tile instead of the SVG's
 *     0.72). iOS 26 composites its Liquid Glass material over a flat web-clip icon, and the
 *     lens band along the lower edge lifts dark ink there to grey and smears its edge — the
 *     gear's bottom tooth sat 12% from the edge, inside that band; at 0.62 it sits 17% out.
 *   - The mark is centred on the tile by its OWN centre (MARK_CENTRE): the gear is drawn in a
 *     640-unit space around (320, 320), so the inset is 256 − 320·s, not (512 − 512·s)/2.
 *     v2.4095 used the latter and shipped the mark 8% right and down, its bottom tooth 9% from
 *     the edge — deeper in the band than before (v2.4158).
 *   - 1024 px (Apple's icon canvas) so the App Library, Spotlight and the large-icon layout
 *     never upscale it; the home screen downsamples cleanly.
 *
 * Rendered with the Chromium that @playwright/test already installs for the e2e suite
 * (the previous 180 px file was byte-identical to a Chromium render, so this is the same
 * rasteriser). Re-run with:
 *   npm run gen-app-icon
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024
const MARK_SCALE = 0.62
const SVG_BOX = 512
/** The mark's own centre: the gear path lives in a 640-unit space around (320, 320). */
const MARK_CENTRE = 320
/** The SVG's own placement of the mark: translate(256 − 320·s) scale(s) at s = 0.72 → 25.60. */
const SVG_MARK_TRANSFORM = 'transform="translate(25.60 25.60) scale(0.7200)"'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = join(__dirname, '..', 'public', 'favicon.svg')
const outPath = join(__dirname, '..', 'public', 'apple-touch-icon.png')

const source = readFileSync(svgPath, 'utf8')
if (!source.includes(SVG_MARK_TRANSFORM)) {
  throw new Error(`favicon.svg no longer carries ${SVG_MARK_TRANSFORM}; update SVG_MARK_TRANSFORM`)
}
const inset = (SVG_BOX / 2 - MARK_CENTRE * MARK_SCALE).toFixed(2)
const art = source
  .replace('rx="112"', 'rx="0"')
  .replace(SVG_MARK_TRANSFORM, `transform="translate(${inset} ${inset}) scale(${MARK_SCALE.toFixed(4)})"`)
  .replace('<svg ', `<svg width="${SIZE}" height="${SIZE}" `)

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 })
  await page.setContent(`<body style="margin:0"><div id="tile" style="width:${SIZE}px;height:${SIZE}px">${art}</div></body>`)
  const png = await page.locator('#tile').screenshot({ type: 'png', omitBackground: false })
  writeFileSync(outPath, png)
  console.log(`Wrote ${outPath} (${png.length} bytes, ${SIZE}x${SIZE}, mark at ${MARK_SCALE} of the tile)`)
} finally {
  await browser.close()
}
