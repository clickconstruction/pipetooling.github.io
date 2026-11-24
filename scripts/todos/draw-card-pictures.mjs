#!/usr/bin/env node
/**
 * `npm run todo:pictures -- <card number>` draws one punch-list card's pictures again and rewrites its
 * pictures page (punch list #438, PR 3). The pictures are the real app in a sealed lens frame on a local
 * dev server, with invented rows: `to-dos/punch-list-answers-and-pictures/how-the-pictures-were-drawn.md`.
 *
 * What it does, in order:
 *   1. reads the card from the kit's `pages/cards.json`: its pictures and the scripts that draw them (`draw`,
 *      each line a script and the words it takes);
 *   2. starts the dev server with the kit's config on port 5187, or uses the one `PIC_BASE` names;
 *   3. runs each script; the PNGs land in a new folder under the system's temp folder, never in the repo;
 *   4. turns each PNG the card names into WebP (`cwebp`), cut where the card says (`crop`);
 *   5. stamps the card with today and the newest version on this checkout (`drawn`, `drawnAt`);
 *   6. writes the card's page with `pages/make-pages.cjs --card <number>`.
 *
 * It stops, and changes nothing, when a script fails or a picture the card names was not drawn: the app
 * may have changed under the script, and the script is then the thing to mend. It does not cut the lead
 * picture beside the card, which is a choice. Look at every picture before the commit.
 *
 * Needs: `.env.local` (the app does not start without it), Playwright's Chromium, and `cwebp`
 * (`brew install webp`).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const KIT = join(ROOT, 'to-dos/punch-list-answers-and-pictures/draw')
const CARDS_FILE = join(KIT, 'pages/cards.json')
const PORT = 5187

function fail(message) {
  console.error(`todo:pictures: ${message}`)
  process.exit(1)
}

/** The newest `v2.NNNN` this checkout has a release note for. */
function newestVersion() {
  const numbers = readdirSync(join(ROOT, 'src/content/releaseNotes'))
    .map((f) => /^v2\.(\d+)\.ts$/.exec(f)?.[1])
    .filter(Boolean)
    .map(Number)
  return `v2.${Math.max(...numbers)}`
}

/** A local day: the page is dated for people in one office. */
function today() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The picture's width and height, read off the PNG's own header. */
function pngSize(file) {
  const b = readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

async function answers(base) {
  try {
    const res = await fetch(`${base}/favicon.svg`)
    return res.ok
  } catch {
    return false
  }
}

/** The kit's dev server: the one `PIC_BASE` names, one already on the port, or a new one this run stops. */
async function devServer() {
  if (process.env.PIC_BASE) {
    if (!(await answers(process.env.PIC_BASE))) fail(`nothing answers at PIC_BASE (${process.env.PIC_BASE}).`)
    return { base: process.env.PIC_BASE, stop: () => {} }
  }
  const base = `http://localhost:${PORT}`
  if (await answers(base)) {
    console.log(`A server already answers on port ${PORT}. Using it. It must be the kit's own server, or the frame takes no rows.`)
    return { base, stop: () => {} }
  }
  if (!existsSync(join(ROOT, '.env.local'))) fail('no .env.local in this checkout. The app does not start without it.')
  const child = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--config', join(KIT, 'vite.config.ts'), '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })
  const stop = () => child.kill()
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) fail(`the dev server stopped with code ${child.exitCode}. Port ${PORT} may be taken.`)
    if (await answers(base)) return { base, stop }
    await new Promise((r) => setTimeout(r, 1000))
  }
  stop()
  fail('the dev server did not answer within two minutes.')
}

async function main() {
  const number = Number(process.argv[2])
  if (!Number.isInteger(number)) fail('give the card its number: npm run todo:pictures -- 396')
  const cards = JSON.parse(readFileSync(CARDS_FILE, 'utf8'))
  const card = cards.find((c) => c.number === number)
  if (!card) fail(`the kit holds no pictures for #${number}. Its cards: ${cards.map((c) => `#${c.number}`).join(' ')}.`)
  if (!card.draw?.length) fail(`#${number} names no script that draws it (draw in pages/cards.json).`)
  if (spawnSync('cwebp', ['-version']).status !== 0) fail('cwebp is not installed (brew install webp).')

  const out = mkdtempSync(join(tmpdir(), `punch-list-pictures-${number}-`))
  const webp = join(out, 'webp')
  mkdirSync(webp)
  const server = await devServer()
  try {
    for (const line of card.draw) {
      // A draw line is a script and the words it takes: `396-426-189/pace2.cjs behind dark`.
      const [script, ...words] = line.split(/\s+/)
      console.log(`Drawing with ${line} …`)
      const run = spawnSync(process.execPath, [join(KIT, script), ...words], {
        cwd: ROOT,
        stdio: 'inherit',
        env: { ...process.env, NODE_PATH: join(ROOT, 'node_modules'), PIC_OUT: out, PIC_BASE: server.base },
      })
      if (run.status !== 0) fail(`${line} failed. Nothing was written. The pictures it drew are in ${out}.`)
    }
  } finally {
    server.stop()
  }

  const missing = card.pictures.filter((p) => !existsSync(join(out, p.file.replace(/\.webp$/, '.png'))))
  if (missing.length > 0) {
    fail(`${missing.length} of the card's ${card.pictures.length} pictures were not drawn: ${missing.map((p) => p.file).join(', ')}. Nothing was written. What was drawn is in ${out}.`)
  }
  for (const p of card.pictures) {
    const png = join(out, p.file.replace(/\.webp$/, '.png'))
    const crop = Array.isArray(p.crop) ? ['-crop', ...p.crop.map(String)] : []
    const made = spawnSync('cwebp', ['-quiet', '-q', '80', '-m', '6', ...crop, png, '-o', join(webp, p.file)])
    if (made.status !== 0) fail(`cwebp could not write ${p.file}: ${made.stderr?.toString().trim() ?? ''}`)
    const size = pngSize(png)
    p.w = Array.isArray(p.crop) ? p.crop[2] : size.w
    p.h = Array.isArray(p.crop) ? p.crop[3] : size.h
  }
  card.drawn = today()
  card.drawnAt = newestVersion()
  writeFileSync(CARDS_FILE, `${JSON.stringify(cards, null, 1)}\n`)

  const page = spawnSync(process.execPath, [join(KIT, 'pages/make-pages.cjs'), webp, '--card', String(number)], { cwd: ROOT, stdio: 'inherit' })
  if (page.status !== 0) fail('the page maker failed. cards.json is stamped, the page is not written.')

  console.log(`\n#${number}: ${card.pictures.length} pictures drawn on ${card.drawn} with main at ${card.drawnAt}, and its page written.`)
  console.log(`Look at every picture before the commit: ${out}`)
  console.log('The lead picture beside the card was not cut again. Cut it by hand if the screen changed.')
}

await main()
