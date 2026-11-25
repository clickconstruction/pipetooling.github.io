// Shooter for the punch-list pictures (punch list #438): every page is a sealed lens frame on the local dev server.
// Run a script from the repo root: NODE_PATH=$PWD/node_modules node scripts/todos/pictures-kit/<group>/<script>.cjs
// Pictures land in PIC_OUT, or in a folder under the system's temp folder. Nothing is written into the repo.
const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')
const BASE = process.env.PIC_BASE || 'http://localhost:5187'
const OUT = process.env.PIC_OUT || path.join(require('os').tmpdir(), 'punch-list-pictures')
fs.mkdirSync(OUT, { recursive: true })

let browser
async function open({ as, theme = 'light', mood = 'full', width = 1280, height = 900, phone = false, extra = null, scale = 1 }) {
  if (!browser) browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale, hasTouch: phone, isMobile: phone, serviceWorkers: 'block' })
  const name = 'pipetooling-lens:' + JSON.stringify({ as, mood, theme })
  // The name is set before any page script on every document, so no page of this context can load unsealed.
  await ctx.addInitScript(({ name, extra }) => { window.name = name; if (extra) window.__picExtra = extra }, { name, extra })
  const page = await ctx.newPage()
  const outside = []
  page.on('request', (r) => { const u = r.url(); if (/supabase\.(co|in)/.test(u)) outside.push(u) })
  page.sealed = async () => {
    const cfg = await page.evaluate(() => (window.__lens ? window.__lens.config : null)).catch(() => null)
    if (!cfg || cfg.as !== as) { await ctx.close(); throw new Error('NOT SEALED: closed the page at once') }
    if (outside.length) { await ctx.close(); throw new Error('A request left for Supabase: ' + outside[0]) }
    return cfg
  }
  page.go = async (p, wait = 2500) => {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded', timeout: 180000 })
    await page.waitForFunction(() => !!window.__lens, null, { timeout: 60000 }).catch(() => {})
    await page.sealed()
    await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {})
    await page.waitForTimeout(wait)
    await page.sealed()
  }
  page.shot = async (file, opts = {}) => {
    await page.sealed()
    const f = path.join(OUT, file)
    if (opts.locator) await opts.locator.screenshot({ path: f })
    else await page.screenshot({ path: f, fullPage: !!opts.full, clip: opts.clip })
    console.log('shot', file)
  }
  page.asks = async (filter) => {
    const a = await page.evaluate(() => window.__lens.asks)
    const seen = new Map()
    for (const x of a) { const k = `${x.kind} ${x.name} ${x.method} ${x.by} ${x.status}`; seen.set(k, (seen.get(k) || 0) + 1) }
    const lines = [...seen.entries()].map(([k, n]) => `${k} x${n}`)
    return filter ? lines.filter((l) => filter.test(l)) : lines
  }
  page.errs = () => page.evaluate(() => window.__lens.errors)
  page.close2 = () => ctx.close()
  return page
}
async function done() { if (browser) await browser.close() }
module.exports = { open, done, OUT, BASE }
