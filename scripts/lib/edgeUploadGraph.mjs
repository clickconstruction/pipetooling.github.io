/**
 * What `supabase functions deploy <slug>` uploads for a function (v2.7135): its index.ts and every file reached
 * through a relative static `import` or `export … from`, type-only imports included, since the CLI uploads those
 * too. On 2026-11-13 this list matched the CLI's own `--debug` "Uploading asset" lines for legal-portal file for file
 * (257 files, 4,213,815 bytes). The API refuses a deploy over its 5 MB limit with HTTP 413: legal-portal was refused
 * at about 4.74 MB of source on 2026-11-12, and dev-mcp went through at about 4.71 MB, then was refused at 5.02 MB on
 * 2026-11-13 (v2.7256: the copy of the kernels named the whole generated database types, 1.48 MB, by type imports).
 * `check:edge-bundles` fails a PR when any function's upload passes `UPLOAD_CEILING_BYTES` (`uploadReport`).
 *
 *   node scripts/lib/edgeUploadGraph.mjs [slug …]    (every function when none is named), largest first
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.[^'"]+)['"]/g

function resolveImport(fromFile, spec) {
  const t = resolve(dirname(fromFile), spec)
  if (existsSync(t) && statSync(t).isFile()) return t
  for (const ext of ['.ts', '.tsx', '/index.ts']) if (existsSync(t + ext)) return t + ext
  return null
}

/**
 * The upload of one function: `files` (repo-relative paths, in the order reached), `bytes`, and `via(path)`, the first
 * import chain that reaches a file (repo-relative, entry first), or null when the function does not upload it.
 */
export function edgeUpload(entryFile, root = process.cwd()) {
  const entry = resolve(root, entryFile)
  const parent = new Map([[entry, null]])
  const sizes = new Map()
  const queue = [entry]
  while (queue.length > 0) {
    const f = queue.shift()
    sizes.set(f, statSync(f).size)
    for (const m of readFileSync(f, 'utf8').matchAll(IMPORT_RE)) {
      const t = resolveImport(f, m[1] ?? m[2])
      if (!t || parent.has(t)) continue
      parent.set(t, f)
      queue.push(t)
    }
  }
  const rel = (f) => relative(root, f)
  let bytes = 0
  for (const b of sizes.values()) bytes += b
  return {
    files: [...sizes.keys()].map(rel),
    bytes,
    /** The `n` biggest files it uploads, as [repo-relative path, bytes], biggest first. */
    biggest(n) {
      return [...sizes].map(([f, b]) => [rel(f), b]).sort((a, b) => b[1] - a[1]).slice(0, n)
    },
    via(path) {
      const hit = [...sizes.keys()].find((f) => rel(f) === path)
      if (!hit) return null
      const chain = []
      for (let x = hit; x; x = parent.get(x)) chain.unshift(rel(x))
      return chain
    },
  }
}

/** Every function's upload, largest first: { slug, files, bytes, biggest } (`biggest`: its three biggest files). */
export function edgeUploads(functionsDir = 'supabase/functions', root = process.cwd()) {
  const dir = resolve(root, functionsDir)
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && existsSync(join(dir, d.name, 'index.ts')))
    .map((d) => {
      const u = edgeUpload(join(functionsDir, d.name, 'index.ts'), root)
      return { slug: d.name, files: u.files.length, bytes: u.bytes, biggest: u.biggest(3) }
    })
    .sort((a, b) => b.bytes - a.bytes)
}

/**
 * The most a function's upload may be in a PR (v2.7256): 4 MB of raw source, a fifth under the 5 MB the deploy refuses
 * with HTTP 413, so a function nearing the limit is named in its PR and not at the deploy after it merges.
 */
export const UPLOAD_CEILING_BYTES = 4_000_000

const mb = (bytes) => `${(bytes / 1e6).toFixed(2)} MB`

/**
 * What `check:edge-bundles` says of the uploads (`edgeUploads`' rows): `over`, the slugs past the ceiling, and `lines`,
 * each of those with its three biggest files, then the five biggest uploads.
 */
export function uploadReport(uploads, ceiling = UPLOAD_CEILING_BYTES) {
  const sorted = [...uploads].sort((a, b) => b.bytes - a.bytes)
  const over = sorted.filter((u) => u.bytes > ceiling)
  const row = (u) => `${mb(u.bytes).padStart(8)}  ${String(u.files).padStart(4)} files  ${u.slug}`
  const lines = []
  for (const u of over) {
    lines.push(`  - ${u.slug}: ${mb(u.bytes)}, ${mb(u.bytes - ceiling)} past the ceiling. Its biggest files:`)
    for (const [path, bytes] of u.biggest ?? []) lines.push(`      ${mb(bytes).padStart(8)}  ${path}`)
  }
  return { over: over.map((u) => u.slug), lines, biggest: sorted.slice(0, 5).map(row), ceiling: mb(ceiling) }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const want = new Set(process.argv.slice(2))
  for (const u of edgeUploads()) {
    if (want.size > 0 && !want.has(u.slug)) continue
    console.log(`${mb(u.bytes)}  ${String(u.files).padStart(4)} files  ${u.slug}`)
  }
}
