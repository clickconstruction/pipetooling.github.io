// The card's own mock-up, shot as it is from file:// (no dev server): the frames for PRs 4 to 6, which are not built.
const { chromium } = require('playwright')
const path = require('path')
// Pictures land where the shooter's do: PIC_OUT, or a folder under the system's temp folder.
const OUT = process.env.PIC_OUT || path.join(require('os').tmpdir(), 'punch-list-pictures')
require('fs').mkdirSync(OUT, { recursive: true })
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' })
  // Run from the repo root: the card's own mock-up, as it stands.
  await p.goto('file://' + path.join(process.cwd(), 'to-dos/stickers-before-boxes/mockup.html'))
  await p.waitForTimeout(800)
  const union = async (sel) => {
    const boxes = await p.locator(sel).evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, r: r.right + scrollX, b: r.bottom + scrollY } }))
    const x = Math.min(...boxes.map((q) => q.x)) - 8, y = Math.min(...boxes.map((q) => q.y)) - 8
    return { x, y, width: Math.max(...boxes.map((q) => q.r)) - x + 8, height: Math.max(...boxes.map((q) => q.b)) - y + 8 }
  }
  await p.screenshot({ path: path.join(OUT, '329-mockup-pr4-change-it-desk-light.png'), fullPage: true, clip: await union('h2#rename + p + div.three .col.sug') })
  await p.screenshot({ path: path.join(OUT, '329-mockup-pr5-sticker-walk-desk-light.png'), fullPage: true, clip: await union('h2#walk + p + div.two .col.sug') })
  await p.screenshot({ path: path.join(OUT, '329-mockup-pr6-sheet-of-30-desk-light.png'), fullPage: true, clip: await union('h2#sticker + p + div.three .col:nth-child(3)') })
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
