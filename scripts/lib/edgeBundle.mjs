/**
 * Edge-function bundles for the drift check (scripts/check-edge-function-drift.mjs). Plain JS with
 * no dependencies: the drift workflow runs it on bare Node, without `npm install`.
 *
 * A function's deploy bundles its `index.ts` plus every relative import, transitively — `_shared/`
 * files included. Statement-level `import type` / `export type` are erased at deploy, so their files
 * never reach the bundle (a downloaded deploy has none of them).
 */

import { createHash } from 'node:crypto'
import { dirname, relative, resolve } from 'node:path'

// A static import or re-export. The clause may span lines but never runs into the next statement.
const STATIC_FROM = /^[ \t]*(?:import|export)\b((?:(?!^[ \t]*(?:import|export)\b)[^'"`;])*?)\bfrom\s*(['"])([^'"]+)\2/gm
const SIDE_EFFECT = /^[ \t]*import\s*(['"])([^'"]+)\1/gm
const DYNAMIC = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g
// `import type {…} from` — but `import type from` is a default import named "type".
const TYPE_ONLY_CLAUSE = /^\s*type\s+(?!from\b)[\w{*]/

/** Specifiers a module loads when it runs: static imports and re-exports, side-effect and dynamic imports. */
export function runtimeImportSpecifiers(source) {
  const out = new Set()
  for (const m of source.matchAll(STATIC_FROM)) if (!TYPE_ONLY_CLAUSE.test(m[1])) out.add(m[3])
  for (const m of source.matchAll(SIDE_EFFECT)) out.add(m[2])
  for (const m of source.matchAll(DYNAMIC)) out.add(m[2])
  return [...out]
}

/**
 * The repo files a function's deploy bundles, as `root`-relative paths: `entry` plus every relative
 * import it reaches. `unresolved` lists imports whose file is missing (`file -> specifier`).
 */
export function walkBundle(root, entry, { readFile, exists }) {
  const seen = new Set()
  const unresolved = []
  const stack = [resolve(root, entry)]
  while (stack.length > 0) {
    const file = stack.pop()
    if (seen.has(file)) continue
    seen.add(file)
    for (const spec of runtimeImportSpecifiers(readFile(file))) {
      if (!spec.startsWith('./') && !spec.startsWith('../')) continue
      const target = resolve(dirname(file), spec)
      if (exists(target)) stack.push(target)
      else unresolved.push(`${relative(root, file)} -> ${spec}`)
    }
  }
  return { files: [...seen].map((f) => relative(root, f)).sort(), unresolved }
}

/** path -> commits touching it, newest first, from `git log --format=@%ct%x09%h%x09%s --name-only`. */
export function commitsByFile(gitLog) {
  const byFile = new Map()
  let commit = null
  for (const line of gitLog.split('\n')) {
    if (line.startsWith('@')) {
      const [ct, hash, ...subject] = line.slice(1).split('\t')
      commit = { ms: Number(ct) * 1000, hash, subject: subject.join('\t') }
    } else if (line.trim() && commit) {
      if (!byFile.has(line)) byFile.set(line, [])
      byFile.get(line).push(commit)
    }
  }
  return byFile
}

/** The distinct commits newer than `sinceMs` that touch any of `files`, newest first. */
export function commitsSince(files, byFile, sinceMs) {
  const found = new Map()
  for (const file of files) {
    for (const c of byFile.get(file) ?? []) if (c.ms > sinceMs) found.set(c.hash, c)
  }
  return [...found.values()].sort((a, b) => b.ms - a.ms)
}

/** Every blob id named in `git log --format= --raw --no-abbrev` (the zero id of an add or delete excluded). */
export function historyBlobIds(gitRawLog) {
  const ids = new Set()
  for (const m of gitRawLog.matchAll(/^:\d+ \d+ ([0-9a-f]{40}) ([0-9a-f]{40}) /gm)) {
    for (const id of [m[1], m[2]]) if (!/^0+$/.test(id)) ids.add(id)
  }
  return ids
}

/** Git's blob id for these bytes, so a deployed file can be found in history. */
export function gitBlobId(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
}

/**
 * A deployed bundle against this checkout's. `repo` and `deployed` map repo-relative path -> bytes;
 * `historyBlobs` holds every blob id this checkout's history had under supabase/functions.
 * - current: the same files with the same bytes (line endings aside).
 * - behind: every deployed file that differs is an older version from this history.
 * - elsewhere: a deployed file this history never had, as when a branch deploys before it merges.
 */
export function compareBundles(repo, deployed, historyBlobs) {
  const text = (bytes) => Buffer.from(bytes).toString('utf8').replace(/\r\n/g, '\n')
  const changed = [...repo.keys()].filter((p) => deployed.has(p) && text(deployed.get(p)) !== text(repo.get(p)))
  const added = [...repo.keys()].filter((p) => !deployed.has(p))
  const dropped = [...deployed.keys()].filter((p) => !repo.has(p))
  const foreign = [...changed, ...dropped].filter((p) => !historyBlobs.has(gitBlobId(deployed.get(p))))
  const state = changed.length + added.length + dropped.length === 0 ? 'current' : foreign.length > 0 ? 'elsewhere' : 'behind'
  return { state, changed, added, dropped, foreign }
}

/**
 * The gateway setting a plain `supabase functions deploy <slug>` gives each function, from
 * config.toml: a `[functions.<slug>]` block's `verify_jwt`, else the CLI default (true).
 */
export function configVerifyJwt(configToml, slugs) {
  const explicit = new Map()
  let section = null
  for (const raw of configToml.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim()
    const header = /^\[functions\.("?)([\w-]+)\1\]$/.exec(line)
    if (header) {
      section = header[2]
      continue
    }
    if (line.startsWith('[')) section = null
    const setting = section && /^verify_jwt\s*=\s*(true|false)$/.exec(line)
    if (setting) explicit.set(section, setting[1] === 'true')
  }
  return new Map(slugs.map((slug) => [slug, explicit.get(slug) ?? true]))
}
