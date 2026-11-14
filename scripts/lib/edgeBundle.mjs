/**
 * Edge-function bundles for the drift check (scripts/check-edge-function-drift.mjs). Plain JS with
 * no dependencies: the drift workflow runs it on bare Node, without `npm install`.
 *
 * A function's deploy bundles its `index.ts` plus every relative import, transitively — `_shared/`
 * files included. Statement-level `import type` / `export type` are erased at deploy, so their files
 * never reach the bundle that runs (a downloaded deploy has none of them); the upload carries them all
 * the same, which `edgeUploadGraph.mjs` walks and `check:edge-bundles` holds under a ceiling (v2.7256).
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

/** The pull request a squash names at the end of its subject (`… (#6899)` -> 6899), else null. */
export function pullNumberOf(subject) {
  const m = /\(#(\d+)\)\s*$/.exec(subject ?? '')
  return m ? Number(m[1]) : null
}

/**
 * The commits whose landing time only GitHub can say. A merge-queue squash carries the time the queue BUILT
 * it, not the time it landed on main (v2.6452: #6899 was built 10:07Z and landed 10:35Z, and drive-link was
 * deployed at 10:18Z from a main without it, so commit times called it current). A commit built up to
 * `windowMs` before some deploy and no later than it may have landed after that deploy; each distinct one
 * that names a pull is listed, oldest pull first. A commit built after a deploy is newer than it already.
 */
export function commitsToLand(byFile, deployedMsList, windowMs) {
  if (deployedMsList.length === 0) return []
  const deploys = [...deployedMsList].sort((a, b) => a - b)
  const nearADeploy = (ms) => deploys.some((d) => ms <= d && ms >= d - windowMs)
  const found = new Map()
  for (const commits of byFile.values()) {
    for (const c of commits) {
      if (found.has(c.hash) || !nearADeploy(c.ms)) continue
      const pull = pullNumberOf(c.subject)
      if (pull != null) found.set(c.hash, { hash: c.hash, pull })
    }
  }
  return [...found.values()].sort((a, b) => a.pull - b.pull)
}

/**
 * `byFile` with each commit's `ms` moved to when it landed: `landedMs(commit)` answers the landing time in
 * ms, or null when it is not known. A time never moves backwards; a moved commit keeps the time git has as
 * `builtMs`. Each file's commits stay newest first.
 */
export function withLandingTimes(byFile, landedMs) {
  const moved = new Map()
  const move = (c) => {
    if (!moved.has(c.hash)) {
      const landed = landedMs(c)
      moved.set(c.hash, landed != null && landed > c.ms ? { ...c, ms: landed, builtMs: c.ms } : c)
    }
    return moved.get(c.hash)
  }
  return new Map([...byFile].map(([file, commits]) => [file, commits.map(move).sort((a, b) => b.ms - a.ms)]))
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

/**
 * Link every function the way Deno's loader will when it boots: esbuild bundles `<dir>/<slug>/index.ts`,
 * following relative imports and leaving every remote or bare import (`https:`, `npm:`, `jsr:`, `node:`)
 * external, writing nothing. A name imported from a module that does not export it fails here as it fails
 * at boot (v2.6294: job-drive-folders and photo-save answered 503 BOOT_ERROR for three `_shared` exports
 * that never landed); a type-only import of a missing name passes, as Deno strips it. `esbuild` is handed
 * in so this file stays dependency-free for the drift workflow's bare Node. `dir` is relative to `root`,
 * and so is every path in a message.
 */
export async function linkFunctions(root, dir, slugs, esbuild) {
  const note = (m) => ({ file: m.location?.file ?? null, line: m.location?.line ?? null, text: m.text })
  return Promise.all(
    slugs.map(async (slug) => {
      try {
        const { warnings } = await esbuild.build({
          entryPoints: [`${dir}/${slug}/index.ts`],
          absWorkingDir: root,
          bundle: true,
          write: false,
          format: 'esm',
          platform: 'neutral',
          packages: 'external',
          logLevel: 'silent',
        })
        return { slug, errors: [], warnings: warnings.map(note) }
      } catch (e) {
        const errors = Array.isArray(e.errors) && e.errors.length > 0 ? e.errors : [{ text: String(e.message ?? e) }]
        return { slug, errors: errors.map(note), warnings: (e.warnings ?? []).map(note) }
      }
    }),
  )
}

/**
 * The words for linkFunctions' results: each failing function with its messages, one line per distinct
 * message (a `_shared` break repeats the same line under every importer, which is the point), paths
 * shortened past `dir`; the warnings as one flat list.
 */
export function linkReport(results, dir) {
  const short = (s) => (s ? s.split(`${dir}/`).join('') : s)
  const where = (m) => (m.file ? `${short(m.file)}:${m.line} ` : '')
  const failing = results.filter((r) => r.errors.length > 0)
  const lines = failing.map((r) => {
    const seen = new Set()
    const own = []
    for (const m of r.errors) {
      const key = `${m.file}:${m.line}:${m.text}`
      if (seen.has(key)) continue
      seen.add(key)
      own.push(`      ${where(m)}${short(m.text)}`)
    }
    return `  - ${r.slug}\n${own.join('\n')}`
  })
  const warnings = results.flatMap((r) => r.warnings.map((m) => `${r.slug}: ${where(m)}${short(m.text)}`))
  return { failed: failing.map((r) => r.slug), lines, warnings }
}
