#!/usr/bin/env vite-node
/**
 * The pipe title as files (v2.3814): the sign-in wordmark from `src/lib/pipeWordmark.ts`, written
 * to `public/brand/` as SVG and PNG so it can be used elsewhere — letterhead, a truck, a shirt.
 *
 *   npm run brand:pipe-wordmark
 *
 * Writes, for the word ClickPlumbing.com:
 *   clickplumbing-pipe-white.svg / .png   white pipe, red wheels, transparent — for dark or photo grounds
 *   clickplumbing-pipe-dark.svg  / .png   near-black pipe, red wheels, transparent — for light grounds
 *   clickplumbing-pipe-preview.png        the white mark on the app's dark ground, so the file reads in a folder
 * PNGs are 2400 px wide, rendered by Playwright's Chromium from the same SVG. Re-run after any glyph change.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

import { pipeWordSvg } from '../src/lib/pipeWordmark'

const WORD = 'ClickPlumbing.com'
const OUT = resolve(process.cwd(), 'public/brand')
const PNG_WIDTH = 2400

const variants = [
  { name: 'clickplumbing-pipe-white', color: '#ffffff', ground: null as string | null },
  { name: 'clickplumbing-pipe-dark', color: '#111827', ground: null as string | null },
  { name: 'clickplumbing-pipe-preview', color: '#ffffff', ground: '#1f2937', svg: false },
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    for (const v of variants) {
      const svg = pipeWordSvg(WORD, { color: v.color })
      const big = pipeWordSvg(WORD, { color: v.color, width: PNG_WIDTH })
      if (!svg || !big) throw new Error(`cannot draw "${WORD}"`)
      if (v.svg !== false) {
        writeFileSync(resolve(OUT, `${v.name}.svg`), svg + '\n')
        console.log(`wrote ${v.name}.svg`)
      }
      const pad = v.ground ? 120 : 0
      await page.setContent(
        `<!doctype html><html><body style="margin:0;background:${v.ground ?? 'transparent'}">` +
          `<div id="m" style="display:inline-block;padding:${pad}px;background:${v.ground ?? 'transparent'}">${big.replace('<svg ', '<svg style="display:block" ')}</div></body></html>`,
      )
      const el = page.locator('#m')
      await el.screenshot({ path: resolve(OUT, `${v.name}.png`), omitBackground: !v.ground, type: 'png' })
      console.log(`wrote ${v.name}.png`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
