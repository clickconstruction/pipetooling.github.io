#!/usr/bin/env node
/**
 * The lens's CI report, the capture half (punch list #194). Opens sealed frames of a served build,
 * each named as What everyone sees names them, so they draw on the invented world with no sign-in
 * and no request leaving the page. Screenshots each screen light and dark at a phone and a desk,
 * and notes the errors each frame caught.
 *
 *   node scripts/lens/lensShots.mjs --base http://localhost:4180 --out lens-report/before [--channel chrome]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const base = arg('base')
const out = arg('out')
const channel = arg('channel')
const only = Number(arg('only', '0'))
/** Every capture runs at one fixed moment, so a running timer or today's date never reads as a change. */
const FIXED_TIME = new Date(arg('time', '2026-10-27T15:00:00Z'))
if (!base || !out) {
  console.error('usage: lensShots.mjs --base <url> --out <dir> [--channel chrome]')
  process.exit(2)
}

/** The screens the report holds: each role's busiest pages, as the lens's world draws them. */
export const LENS_REPORT_SCREENS = [
  ['estimator', '/dashboard'], ['estimator', '/bids'], ['estimator', '/jobs'], ['estimator', '/customers'], ['estimator', '/calendar'],
  ['master_technician', '/dashboard'], ['master_technician', '/jobs'], ['master_technician', '/messages'], ['master_technician', '/settings'],
  ['assistant', '/dashboard'], ['assistant', '/messages'],
  ['superintendent', '/dashboard'], ['primary', '/dashboard'], ['subcontractor', '/dashboard'], ['helpers', '/dashboard'],
  ['dev', '/bridge'],
]
const WIDTHS = [['phone', 375, 812], ['desk', 1280, 900]]
const THEMES = ['light', 'dark']

const keyOf = (as, path, theme, width) => `${as}__${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}__${theme}__${width}`

mkdirSync(out, { recursive: true })
const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true })
const shots = []
try {
  for (const [wName, w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: wName === 'phone', hasTouch: wName === 'phone' })
    const page = await ctx.newPage()
    await page.clock.setFixedTime(FIXED_TIME)
    for (const theme of THEMES) {
      for (const [as, path] of only > 0 ? LENS_REPORT_SCREENS.slice(0, only) : LENS_REPORT_SCREENS) {
        const key = keyOf(as, path, theme, wName)
        // Name the window on this origin, then open the screen: the seal reads the name first.
        await page.goto(`${base}/favicon.svg`)
        await page.evaluate((n) => { window.name = n }, `pipetooling-lens:${JSON.stringify({ as, mood: 'full', theme })}`)
        await page.goto(base + path, { waitUntil: 'domcontentloaded' })
        // Settled when the asks stop growing for two seconds, eight at the most.
        let last = -1
        let quiet = 0
        for (let i = 0; i < 16 && quiet < 4; i++) {
          await page.waitForTimeout(500)
          const n = await page.evaluate(() => window.__lens?.asks?.length ?? 0).catch(() => 0)
          quiet = n > 0 && n === last ? quiet + 1 : 0
          last = n
        }
        await page.waitForTimeout(400)
        const errors = await page.evaluate(() => window.__lens?.errors ?? []).catch(() => [])
        const file = `${key}.png`
        await page.screenshot({ path: join(out, file) })
        shots.push({ key, as, path, theme, width: wName, file, errors })
        console.log(`${key}  ${errors.length ? errors.length + ' errors' : 'clean'}`)
      }
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
writeFileSync(join(out, 'shots.json'), JSON.stringify(shots, null, 2))
console.log(`${shots.length} shots in ${out}`)
