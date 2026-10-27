#!/usr/bin/env node
/**
 * The lens's CI report, the comparing half (punch list #194). Reads a before and an after capture
 * (lensShots.mjs), compares each pair pixel by pixel in a headless browser's canvas, and writes an
 * HTML report: every changed screen first with before, after and the changed pixels marked, then the
 * unchanged ones. Prints a one-line summary for the job's page.
 *
 *   node scripts/lens/lensReport.mjs --before lens-report/before --after lens-report/after --out lens-report [--channel chrome]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { chromium } from '@playwright/test'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}
const beforeDir = arg('before')
const afterDir = arg('after')
const out = arg('out')
const channel = arg('channel')
/** A screen counts as changed when more than this share of its pixels differ. */
const CHANGED = Number(arg('threshold', '0.002'))

const read = (dir) => (existsSync(join(dir, 'shots.json')) ? JSON.parse(readFileSync(join(dir, 'shots.json'), 'utf8')) : [])
const before = new Map(read(beforeDir).map((s) => [s.key, s]))
const after = read(afterDir)
const dataUrl = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`

const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true })
const page = await browser.newPage()
await page.setContent('<canvas id="a"></canvas><canvas id="b"></canvas><canvas id="d"></canvas>')
const rows = []
for (const s of after) {
  const b = before.get(s.key)
  if (!b) {
    rows.push({ ...s, share: null, diff: null, beforeFile: null })
    continue
  }
  const res = await page.evaluate(async ([ua, ub]) => {
    const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
    const [ia, ib] = await Promise.all([load(ua), load(ub)])
    const w = Math.max(ia.width, ib.width)
    const h = Math.max(ia.height, ib.height)
    const ctx = (id) => { const c = document.getElementById(id); c.width = w; c.height = h; return c.getContext('2d') }
    const ca = ctx('a'), cb = ctx('b'), cd = ctx('d')
    ca.drawImage(ia, 0, 0)
    cb.drawImage(ib, 0, 0)
    const da = ca.getImageData(0, 0, w, h).data
    const db = cb.getImageData(0, 0, w, h).data
    cd.drawImage(ib, 0, 0)
    cd.fillStyle = 'rgba(255,255,255,0.75)'
    cd.fillRect(0, 0, w, h)
    const dd = cd.getImageData(0, 0, w, h)
    let changed = 0
    for (let p = 0; p < da.length; p += 4) {
      const delta = Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2])
      if (delta > 24) {
        changed++
        dd.data[p] = 230; dd.data[p + 1] = 30; dd.data[p + 2] = 60; dd.data[p + 3] = 255
      }
    }
    cd.putImageData(dd, 0, 0)
    return { share: changed / (w * h), diff: document.getElementById('d').toDataURL('image/png') }
  }, [dataUrl(join(beforeDir, b.file)), dataUrl(join(afterDir, s.file))])
  rows.push({ ...s, share: res.share, diff: res.diff, beforeFile: b.file })
}
await browser.close()

const changed = rows.filter((r) => r.share === null || r.share > CHANGED).sort((x, y) => (y.share ?? 1) - (x.share ?? 1))
const same = rows.filter((r) => !changed.includes(r))
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const card = (r) => `<section><h3>${esc(r.path)} · ${esc(r.as)} · ${r.theme} · ${r.width} <small>${r.share === null ? 'new screen' : `${(r.share * 100).toFixed(2)}% of pixels changed`}${r.errors?.length ? ` · ${r.errors.length} errors caught` : ''}</small></h3><div class="row">${r.beforeFile ? `<figure><figcaption>Before</figcaption><img src="${esc(relative(out, join(beforeDir, r.beforeFile)))}"></figure>` : ''}<figure><figcaption>After</figcaption><img src="${esc(relative(out, join(afterDir, r.file)))}"></figure>${r.diff ? `<figure><figcaption>Changed pixels</figcaption><img src="${r.diff}"></figure>` : ''}</div></section>`
const summary = `${rows.length} screens · ${changed.length} changed · ${same.length} the same`
writeFileSync(join(out, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lens report</title><style>body{font:14px/1.45 system-ui,sans-serif;margin:16px;color:#111;background:#f4f5f7}h1{font-size:20px}h3{font-size:14px;margin:18px 0 6px}h3 small{font-weight:400;color:#555}.row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}figure{margin:0;max-width:100%}figcaption{font-size:12px;color:#555}img{max-width:min(420px,100%);border:1px solid #ccd;border-radius:6px;background:#fff}details{margin-top:24px}</style></head><body><h1>What everyone sees · before and after</h1><p>${esc(summary)}. Every screen is the real app drawn on the lens's invented world, light and dark, at 375 and 1280.</p>${changed.map(card).join('')}<details><summary>${same.length} screens with no change</summary>${same.map(card).join('')}</details></body></html>`)
console.log(summary)
