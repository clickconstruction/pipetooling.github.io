#!/usr/bin/env node
/**
 * What a built app weighs, read from `dist/` after `vite build` (the main chunk's split, v2.8327).
 *
 *   node scripts/measure-build.mjs [dist] [PayLink EstimateAccept …]
 *
 * It prints the main chunk, the largest file the service worker precaches against the cap in
 * `vite.config.ts`, and for each page named what a first visit downloads to draw it: `index.html`, the
 * entry's script and style, every chunk those import by name, and the page's own chunk with what it
 * imports by name. A page with no chunk of its own is in the entry, and its line says so. Bytes are the
 * files' own and gzipped, since GitHub Pages serves them gzipped.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const [distArg, ...pageArgs] = process.argv.slice(2)
const dist = distArg && !/^[A-Z]/.test(distArg) ? distArg : 'dist'
const pages = distArg && /^[A-Z]/.test(distArg) ? [distArg, ...pageArgs] : pageArgs
const assets = join(dist, 'assets')
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`measure-build: no ${dist}/index.html. Run the build first.`)
  process.exit(1)
}

const names = readdirSync(assets)
const text = new Map()
const read = (name) => {
  if (!text.has(name)) text.set(name, readFileSync(join(assets, name)))
  return text.get(name)
}
const size = (buf) => ({ raw: buf.length, gz: gzipSync(buf).length })
const add = (a, b) => ({ raw: a.raw + b.raw, gz: a.gz + b.gz })
const n = (x) => x.toLocaleString('en-US')

/** The chunks a chunk imports by name: `from"./x.js"` and `import"./x.js"`, never `import("./x.js")`. */
function namedImports(name) {
  const code = read(name).toString('utf8')
  const out = new Set()
  for (const m of code.matchAll(/(?:from|import)\s*"\.\/([^"]+\.m?js)"/g)) out.add(m[1])
  return [...out]
}
function closure(start) {
  const seen = new Set()
  const stack = [...start]
  while (stack.length) {
    const name = stack.pop()
    if (seen.has(name) || !names.includes(name)) continue
    seen.add(name)
    if (/\.m?js$/.test(name)) stack.push(...namedImports(name))
  }
  return seen
}

const html = readFileSync(join(dist, 'index.html'))
const htmlText = html.toString('utf8')
const entry = /<script[^>]*type="module"[^>]*src="\/assets\/([^"]+)"/.exec(htmlText)?.[1]
if (!entry) {
  console.error('measure-build: index.html names no entry script.')
  process.exit(1)
}
const styles = [...htmlText.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="\/assets\/([^"]+)"/g)].map((m) => m[1])
const shell = closure([entry, ...styles])
const sum = (set) => [...set].reduce((acc, name) => add(acc, size(read(name))), { raw: 0, gz: 0 })
const shellBytes = add(size(html), sum(shell))

/** The files a chunk asks for beside itself when it is fetched on demand: its entries in the importer's preload table. */
function onDemandWith(pageChunk) {
  const code = read(entry).toString('utf8')
  const table = /__vite__mapDeps=\(i,m=__vite__mapDeps,d=\(m\.f\|\|\(m\.f=(\[[^\]]*\])/.exec(code)?.[1]
  if (!table) return []
  const files = JSON.parse(table).map((f) => f.replace(/^assets\//, ''))
  const at = code.indexOf(`import("./${pageChunk}")`)
  if (at < 0) return []
  const deps = /__vite__mapDeps\(\[([\d,]*)\]\)/.exec(code.slice(at, at + pageChunk.length + 400))?.[1]
  return deps ? deps.split(',').filter(Boolean).map((i) => files[Number(i)]).filter(Boolean) : []
}

console.log(`build measured: ${dist}`)
console.log(`  main chunk            ${entry}  ${n(statSync(join(assets, entry)).size)} bytes`)

const swPath = join(dist, 'sw.js')
if (existsSync(swPath)) {
  const sw = readFileSync(swPath, 'utf8')
  const precached = [...sw.matchAll(/"?url"?:"([^"]+)"/g)].map((m) => m[1]).filter((u) => existsSync(join(dist, u)))
  const sized = precached.map((u) => [u, statSync(join(dist, u)).size]).sort((a, b) => b[1] - a[1])
  const total = sized.reduce((acc, [, bytes]) => acc + bytes, 0)
  console.log(`  precache              ${sized.length} files, ${n(total)} bytes`)
  for (const [u, bytes] of sized.slice(0, 3)) console.log(`  precached, largest    ${u}  ${n(bytes)} bytes`)
}

console.log(`  every visit           ${n(shellBytes.raw)} bytes, ${n(shellBytes.gz)} gzipped (index.html, ${shell.size} files)`)
for (const page of pages) {
  const chunk = names.find((name) => new RegExp(`^${page}-[\\w-]{8}\\.js$`).test(name))
  if (!chunk) {
    console.log(`  ${page.padEnd(21)} in the entry: ${n(shellBytes.raw)} bytes, ${n(shellBytes.gz)} gzipped`)
    continue
  }
  const own = closure([chunk, ...onDemandWith(chunk)])
  for (const name of shell) own.delete(name)
  const total = add(shellBytes, sum(own))
  console.log(
    `  ${page.padEnd(21)} ${n(total.raw)} bytes, ${n(total.gz)} gzipped (its chunk ${n(statSync(join(assets, chunk)).size)}, ${own.size} files past the entry)`,
  )
}
