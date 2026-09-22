#!/usr/bin/env node
/**
 * Phone-width captures of the app, signed in as a sample account.
 *
 *   node scripts/mobile-surface-shots.mjs --out /tmp/shots [--port 5181] [--as sample-assistant] \
 *        [--width 375 --height 812] [url ...]
 *
 * Signs in through the dev-login edge function (VITE_DEV_LOGIN_SECRET from .env.local) as
 * `sample-<role>@samples.pipetooling.local` (`--as` takes the local part or a full email), walks
 * each URL at the given viewport with an iPhone user agent and touch, and writes per surface:
 *   <out>/<id>.png       the first screen
 *   <out>/<id>-full.png  the whole page
 *   <out>/metrics.json   page height, tap targets under 36 px, text runs under 12 px, inputs
 *                        under 16 px (iOS zooms on focus), elements past the right edge, tables
 *                        and their widths, sideways scrollers — the numbers a mobile pass is
 *                        measured against (to-dos/taunya-mobile.md, punch list #30).
 *
 * With no URLs it walks the assistant's thirteen surfaces from that to-do. Needs a dev server on
 * the port (`npx vite --port 5181`) and Playwright's chromium, which the repo already ships.
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const out = opt('out', '')
const port = Number(opt('port', '5181'))
const asRaw = opt('as', 'sample-assistant')
const width = Number(opt('width', '375'))
const height = Number(opt('height', '812'))
if (!out) {
  console.error('usage: node scripts/mobile-surface-shots.mjs --out <dir> [--port 5181] [--as sample-assistant] [url ...]')
  process.exit(1)
}
fs.mkdirSync(out, { recursive: true })

const email = asRaw.includes('@') ? asRaw : `${asRaw}@samples.pipetooling.local`
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf('=')
    return [l.slice(0, i), l.slice(i + 1).trim()]
  }),
)
if (!env.VITE_DEV_LOGIN_SECRET) {
  console.error('.env.local has no VITE_DEV_LOGIN_SECRET')
  process.exit(1)
}
const BASE = `http://localhost:${port}`

const DEFAULT_SURFACES = [
  ['dashboard', '/dashboard'],
  ['jobs-stages', '/jobs?tab=stages'],
  ['schedule-hub', '/schedule-dispatch'],
  ['dispatch-mode-schedule', '/dispatch-mode/schedule'],
  ['quickfill', '/quickfill'],
  ['materials-supply-houses', '/materials?tab=supply-houses'],
  ['estimates', '/estimates'],
  ['prospects-follow-up', '/prospects?tab=follow-up'],
  ['dispatch-mode', '/dispatch-mode'],
  ['jobs-subs-pay', '/jobs?tab=sub_sheet_ledger'],
  ['jobs-subs-work', '/jobs?tab=subs'],
  ['people-hours', '/people?tab=hours'],
  ['customers', '/customers'],
]
const surfaces = args.length
  ? args.map((u) => [u.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home', u])
  : DEFAULT_SURFACES

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))

await page.goto(`${BASE}/dev-login`, { waitUntil: 'networkidle' })
const signed = await page.evaluate(
  async ({ email, secret, base }) => {
    const mod = await import('/src/lib/supabase.ts')
    const { data, error } = await mod.supabase.functions.invoke('dev-login', {
      body: { email, redirectTo: base + '/dashboard' },
      headers: { 'X-Dev-Login-Secret': secret },
    })
    if (error) return 'invoke error: ' + error.message
    const token = new URL(data.action_link).searchParams.get('token')
    const r = await mod.supabase.auth.verifyOtp({ type: 'magiclink', token_hash: token })
    // Mark the app as just-active so the "back after a gap → schedule" rules stay quiet.
    localStorage.setItem('pipetooling:last-active-at', String(Date.now()))
    return r.error ? 'verify error: ' + r.error.message : 'ok ' + (r.data.user?.email ?? '')
  },
  { email, secret: env.VITE_DEV_LOGIN_SECRET, base: BASE },
)
console.log('sign-in', signed)
if (!signed.startsWith('ok')) {
  await browser.close()
  process.exit(1)
}

const metrics = {}
for (const [id, url] of surfaces) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' }).catch((e) => console.log('goto', id, e.message))
  await page.waitForTimeout(3500)
  const m = await page.evaluate(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const controls = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=tab]')].filter(vis)
    const small = controls.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 36 || r.width < 36 })
    const texts = [...document.querySelectorAll('body *')]
      .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
      .filter(vis)
    const sizes = texts.map((el) => parseFloat(getComputedStyle(el).fontSize))
    const inputsZoom = [...document.querySelectorAll('input,select,textarea')].filter(vis).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).length
    const wide = [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > vw + 2 && vis(el)).length
    const tables = [...document.querySelectorAll('table')].filter(vis).map((t) => ({
      width: Math.round(t.getBoundingClientRect().width),
      cols: t.querySelectorAll('thead th, tr:first-child td, tr:first-child th').length,
    }))
    const scrollers = [...document.querySelectorAll('body *')]
      .filter((el) => { const cs = getComputedStyle(el); return (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 4 && vis(el) })
      .map((el) => ({ clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }))
    return {
      url: location.pathname + location.search,
      pageHeight: document.documentElement.scrollHeight,
      viewport: { width: vw, height: vh },
      controls: controls.length,
      controlsAboveFold: controls.filter((el) => el.getBoundingClientRect().top < vh).length,
      smallTargets: small.length,
      textUnder12: sizes.filter((f) => f < 12).length,
      inputsUnder16: inputsZoom,
      pastRightEdge: wide,
      tables,
      scrollers: scrollers.slice(0, 8),
      heading: document.querySelector('h1,h2')?.textContent?.trim().slice(0, 80) ?? null,
    }
  })
  metrics[id] = m
  await page.screenshot({ path: path.join(out, `${id}.png`) })
  await page.screenshot({ path: path.join(out, `${id}-full.png`), fullPage: true }).catch((e) => console.log('full-page', id, e.message))
  console.log(id.padEnd(26), `${m.url}  height=${m.pageHeight}  controls=${m.controls}  small=${m.smallTargets}  under12=${m.textUnder12}  inputs<16=${m.inputsUnder16}  pastEdge=${m.pastRightEdge}  tables=${m.tables.length}`)
}
fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 2))
await browser.close()
