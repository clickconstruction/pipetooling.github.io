/**
 * Visual QA sweep (v2.2661) — screenshots every surface AND audits what it captured.
 *
 * Born from a screenshot review that caught three rendering bugs no test saw (v2.2478,
 * v2.2481: customer documents inheriting the login shell's white text, and the same
 * document rendering dark-on-dark in the app's dark theme). Eyes found those; this finds
 * the next ones automatically.
 *
 * Checks per surface:
 *   contrast  — every visible text node vs its effective background (WCAG ratio).
 *               < 3.0 is reported; that is far below AA and always a real defect, not taste.
 *   overflow  — document scrolls sideways (the house rule is it must not).
 *   images    — <img> that resolved to nothing.
 *   console   — page errors during load.
 *
 * Usage:
 *   node scripts/visual-qa.mjs                          # authenticated app surfaces, light
 *   node scripts/visual-qa.mjs --theme dark             # same, dark theme pinned
 *   node scripts/visual-qa.mjs --mobile                 # 390px viewport
 *   node scripts/visual-qa.mjs --only estimates-list
 *   node scripts/visual-qa.mjs --extra accept=https://…/estimate/accept?t=…   # public/token pages
 *   node scripts/visual-qa.mjs --json findings.json     # machine-readable report
 *
 * Requires the dev server (npm run dev) and, for app surfaces, dev-login (see AGENTS.md).
 */
import { chromium } from 'playwright-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const argVal = (name, dflt) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}
const hasFlag = (name) => args.includes(`--${name}`)

const BASE = argVal('base', process.env.VISUAL_QA_BASE || 'http://localhost:5188')
const OUT = argVal('out', 'visual-qa-out')
const THEME = argVal('theme', 'light')
const MOBILE = hasFlag('mobile')
const ONLY = argVal('only', null)
const JSON_OUT = argVal('json', null)
const CONTRAST_FLOOR = Number(argVal('contrast-floor', '3'))

/**
 * Authenticated app surfaces. Data-agnostic: each renders from whatever the org has.
 * Paths are checked against src/App.tsx — a route that 404s still renders a fallback page,
 * so the sweep reports findings for it and the bad entry hides in plain sight (that is how
 * `/schedule` and `/workflow` survived the first run; the real paths are below).
 */
const APP_SURFACES = [
  ['dashboard', '/dashboard'],
  ['estimates-list', '/estimates'],
  ['bids-board', '/bids?tab=bid-board'],
  ['bids-followup', '/bids?tab=builder-review'],
  ['bids-working', '/bids?tab=working'],
  ['bids-rfq', '/bids?tab=rfq'],
  ['jobs', '/jobs'],
  ['schedule-dispatch', '/schedule-dispatch'],
  ['calendar', '/calendar'],
  ['projects', '/projects'],
  ['customers', '/customers'],
  ['materials', '/materials'],
  ['tally', '/tally'],
  ['checklist', '/checklist'],
  ['people', '/people'],
  ['banking', '/banking'],
  ['accounts-receivable', '/accounts-receivable'],
  ['partnerships', '/partnerships'],
  ['prospects', '/prospects'],
  ['settings', '/settings'],
  ['quickfill', '/quickfill'],
  ['moneyfill', '/moneyfill'],
  ['documents', '/documents'],
  ['templates', '/templates'],
  ['map', '/map'],
  ['help', '/help'],
]

const extras = args.reduce((acc, a, i) => {
  if (a === '--extra' && args[i + 1]) {
    const [k, ...rest] = args[i + 1].split('=')
    acc.push([k, rest.join('=')])
  }
  return acc
}, [])

/**
 * Runs in the page. Walks visible text, resolves each element's effective background by
 * climbing ancestors, and computes the WCAG contrast ratio. Elements sitting on a
 * background-image are skipped (the ratio is unknowable and photo overlays are deliberate).
 */
const AUDIT = () => {
  const parseRgb = (s) => {
    const m = /rgba?\(([^)]+)\)/.exec(s || '')
    if (!m) return null
    const p = m[1].split(',').map((x) => parseFloat(x.trim()))
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi + 0.05) / (lo + 0.05)
  }
  const over = (fg, bg) => {
    if (fg.a >= 1) return fg
    const a = fg.a
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 }
  }
  /** Effective background: first opaque-enough ancestor color; null if an image intervenes. */
  const effectiveBg = (el) => {
    let node = el
    let acc = null
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = parseRgb(cs.backgroundColor)
      if (c && c.a > 0) {
        acc = acc ? over(acc, c) : c
        if (c.a >= 1) return acc
      }
      node = node.parentElement
    }
    return acc && acc.a >= 1 ? acc : { r: 255, g: 255, b: 255, a: 1 }
  }
  const findings = []
  const seen = new Set()
  const els = document.querySelectorAll('body *')
  for (const el of els) {
    // Only elements that directly own visible text.
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent.trim().length > 1)
    if (own.length === 0) continue
    const text = own.map((n) => n.textContent.trim()).join(' ').slice(0, 60)
    const rect = el.getBoundingClientRect()
    if (rect.width < 4 || rect.height < 4) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.15) continue
    const bg = effectiveBg(el)
    if (!bg) continue
    const fgRaw = parseRgb(cs.color)
    if (!fgRaw) continue
    const fg = over(fgRaw, bg)
    const r = ratio(fg, bg)
    const key = `${text}|${cs.color}`
    if (seen.has(key)) continue
    seen.add(key)
    if (r < window.__CONTRAST_FLOOR__) {
      findings.push({
        kind: 'contrast',
        ratio: Math.round(r * 100) / 100,
        text,
        color: cs.color,
        bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
        fontSize: cs.fontSize,
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string' ? el.className : '').slice(0, 60),
      })
    }
  }
  const de = document.documentElement
  if (de.scrollWidth > de.clientWidth + 2) {
    findings.push({ kind: 'overflow-x', scrollWidth: de.scrollWidth, clientWidth: de.clientWidth })
  }
  for (const img of document.images) {
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) {
      findings.push({ kind: 'broken-image', src: (img.getAttribute('src') || '').slice(0, 120) })
    }
  }
  return findings
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: MOBILE ? { width: 390, height: 844 } : { width: 1440, height: 960 },
    deviceScaleFactor: MOBILE ? 2 : 1,
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 200)))
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
  })
  await page.addInitScript((floor) => {
    window.__CONTRAST_FLOOR__ = floor
  }, CONTRAST_FLOOR)

  const report = []
  let surfaces = extras.length > 0 && ONLY === null && !hasFlag('app') ? [] : APP_SURFACES
  if (ONLY) surfaces = surfaces.filter(([k]) => k === ONLY)

  if (surfaces.length > 0) {
    process.stdout.write('signing in… ')
    await page.goto(`${BASE}/dev-login?as=1&to=/dashboard`)
    await page.waitForURL('**/dashboard', { timeout: 45000 })
    await wait(2000)
    console.log('ok')
    // Pin the theme explicitly. Clearing the override would fall back to the TIME-OF-DAY
    // schedule, which serves dark after hours — an evening "light" run silently audits dark.
    if (THEME === 'schedule') await page.evaluate(() => localStorage.removeItem('themeOverride'))
    else await page.evaluate((t) => localStorage.setItem('themeOverride', t), THEME)
  }

  for (const [key, path] of [...surfaces, ...extras]) {
    const url = path.startsWith('http') ? path : `${BASE}${path}`
    consoleErrors.length = 0
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await wait(3500)
      const findings = await page.evaluate(AUDIT)
      const name = `${key}${MOBILE ? '-mobile' : ''}${THEME === 'dark' ? '-dark' : ''}`
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
      const entry = { surface: key, url, theme: THEME, mobile: MOBILE, findings, consoleErrors: [...new Set(consoleErrors)] }
      report.push(entry)
      const c = findings.filter((f) => f.kind === 'contrast').length
      const o = findings.filter((f) => f.kind === 'overflow-x').length
      const b = findings.filter((f) => f.kind === 'broken-image').length
      const bits = [c ? `${c} contrast` : '', o ? 'overflow-x' : '', b ? `${b} broken img` : '', entry.consoleErrors.length ? `${entry.consoleErrors.length} console` : '']
        .filter(Boolean)
        .join(', ')
      console.log(`${bits ? '⚠ ' : '✓ '}${name}${bits ? ` — ${bits}` : ''}`)
    } catch (e) {
      console.log(`✗ ${key} — ${String(e).slice(0, 100)}`)
      report.push({ surface: key, url, error: String(e).slice(0, 200) })
    }
  }

  await browser.close()
  if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(report, null, 2))
  const total = report.reduce((n, r) => n + (r.findings?.length ?? 0), 0)
  console.log(`\n${report.length} surfaces · ${total} findings · screenshots in ${OUT}/`)
}

run()
