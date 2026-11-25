/**
 * Which tests a pull request's own CI run takes: the ones near its change, and every test that reads files.
 * Plain JS with no dependencies: scripts/ci-near-tests.mjs runs it on bare Node, and src/lib/nearTests.test.ts pins it.
 *
 * On 2026-11-25 the suite was 5,940 files and 24 to 37 minutes of one runner, and every code PR paid it twice,
 * once on its own run and once in the merge queue. The queue is the only way onto main and keeps the whole suite
 * (ci.yml, in shards). A PR's own run takes what its change can break:
 *   - near: every test whose imports reach a changed file, by Vite's own import graph (the script builds it);
 *   - readers: every test whose imports reach a module that reads files instead of importing them (the
 *     source-scan and docs-reading tests, 332 of the 5,940 that day), since no import graph can say which
 *     files such a test opens.
 * Of the 17 PR runs that failed in their tests from 2026-11-20 to 2026-11-25, this pick would have run the
 * failing test in 15, one had no failing test (vitest died closing) and one was a flake in a test the change
 * did not touch.
 *
 * The rule is fail-safe: no files, a list cut at the compare API's cap, a change to what every test runs on or
 * to what picks the tests, or a graph that did not build means the whole suite runs.
 */

import { COMPARE_FILE_CAP } from './docsOnlyChange.mjs'

/**
 * Node's own modules that cannot open a file of the repo. Any other one (fs, child_process, module, worker_threads,
 * vm and whatever Node adds next) counts as reading, so a new one is safe before anyone lists it.
 */
export const PURE_BUILTINS = [
  'assert',
  'async_hooks',
  'buffer',
  'console',
  'crypto',
  'diagnostics_channel',
  'dns',
  'events',
  'http',
  'http2',
  'https',
  'net',
  'os',
  'path',
  'perf_hooks',
  'punycode',
  'querystring',
  'stream',
  'string_decoder',
  'timers',
  'tty',
  'url',
  'util',
  'zlib',
]

/** Packages that read files of the repo when a test calls them: compilers, bundlers, linters, globbers. */
export const DISK_PACKAGES = [
  'typescript', // ts.sys reads source files
  'esbuild', // bundles files from disk
  'vite',
  'rollup',
  'eslint',
  'typescript-eslint',
  'prettier',
  'postcss',
  '@playwright/test',
  'glob',
  'fast-glob',
  'tinyglobby',
  'globby',
  'chokidar',
  'fs-extra',
  'execa',
]

/** A change to one of these changes how every test runs, so no pick is safe. */
export const WHOLE_SUITE_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^vite\.config\.ts$/, // the test config, the aliases and the plugins behind the `virtual:` modules
  /^tsconfig[^/]*\.json$/, // esbuild reads it when it turns a test into JS
  /^\.npmrc$/,
  /^\.nvmrc$/,
  // What decides which tests run. A change to the picker is not a change the picker should narrow.
  /^\.github\/workflows\/ci\.yml$/,
  /^scripts\/ci-near-tests\.mjs$/,
  /^scripts\/lib\/nearTests\.mjs$/,
  /^scripts\/ci-docs-only\.mjs$/,
  /^scripts\/lib\/docsOnlyChange\.mjs$/,
]

/** `typescript/lib/x` is `typescript`; `@scope/name/x` is `@scope/name`. */
export function packageOf(specifier) {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * Whether importing this specifier lets a module read files it does not import.
 * @param {string} specifier as Vite's transform lists it: `node:fs`, `fs`, `react`, `/src/lib/x.ts`,
 *   `/@id/__x00__virtual:punch-list`
 * @param {Iterable<string>} builtins Node's `builtinModules`, for a built-in written without `node:`
 */
export function readsDisk(specifier, builtins = []) {
  if (typeof specifier !== 'string' || specifier.length === 0) return false
  // A `virtual:` module is written at transform time by a plugin in vite.config.ts from files on disk
  // (to-dos/, the release notes folder, src/types/database.ts, src/index.css).
  if (specifier.includes('virtual:')) return true
  if (specifier.startsWith('/') || specifier.startsWith('.')) return false // a file: the graph follows it
  if (/^(npm|jsr|https?):/.test(specifier)) return false // an edge function's Deno import; a test mocks it
  const bare = specifier.startsWith('node:') ? specifier.slice(5) : specifier
  const first = bare.split('/')[0]
  if (specifier.startsWith('node:') || new Set(builtins).has(bare) || new Set(builtins).has(first)) {
    return !PURE_BUILTINS.includes(first)
  }
  return DISK_PACKAGES.includes(packageOf(specifier))
}

/** The test that owns a snapshot file: `a/__snapshots__/x.test.ts.snap` belongs to `a/x.test.ts`. */
export function snapshotOwner(path) {
  const m = /^(.*\/)?__snapshots__\/([^/]+)\.snap$/.exec(path)
  return m ? `${m[1] ?? ''}${m[2]}` : null
}

/**
 * Why the whole suite must run, or null when a pick is safe.
 * @param {string[]} changed every path the PR changes against its base (a rename counts both names)
 * @param {{ cap?: number }} [opts]
 */
export function wholeSuiteReason(changed, opts = {}) {
  const cap = opts.cap ?? COMPARE_FILE_CAP
  const list = Array.from(new Set((changed ?? []).filter((f) => typeof f === 'string' && f.length > 0)))
  if (list.length === 0) return 'no files listed, so the whole suite runs'
  if (list.length >= cap) return `${list.length} files, at the compare cap, so the whole suite runs`
  const hit = list.find((f) => WHOLE_SUITE_PATTERNS.some((re) => re.test(f)))
  if (hit) return `${hit} changes how every test runs, so the whole suite runs`
  return null
}

/**
 * The pick. Paths are repo-relative with forward slashes.
 * @param {{
 *   tests: string[],                       every test file of the suite
 *   importsOf: Map<string, string[]>,      a file's own imports that are files of the repo
 *   readerModules: string[],               the files that import something `readsDisk` says yes to
 *   changed: string[],                     the PR's changed files
 * }} input
 * @returns {{ near: string[], readers: string[], selected: string[] }} near and readers may share a test
 */
export function nearTests({ tests, importsOf, readerModules, changed }) {
  const importers = new Map()
  for (const [file, deps] of importsOf) {
    for (const dep of deps) {
      if (!importers.has(dep)) importers.set(dep, [])
      importers.get(dep).push(file)
    }
  }
  const isTest = new Set(tests)
  const reaching = (starts) => {
    const seen = new Set(starts)
    const stack = [...seen]
    const out = []
    while (stack.length) {
      const file = stack.pop()
      if (isTest.has(file)) out.push(file)
      for (const up of importers.get(file) ?? []) {
        if (!seen.has(up)) {
          seen.add(up)
          stack.push(up)
        }
      }
    }
    return out.sort()
  }
  const starts = []
  for (const file of changed ?? []) {
    starts.push(file)
    const owner = snapshotOwner(file)
    if (owner) starts.push(owner)
  }
  const near = reaching(starts)
  const readers = reaching(readerModules ?? [])
  return { near, readers, selected: Array.from(new Set([...near, ...readers])).sort() }
}

/**
 * The lines written to $GITHUB_OUTPUT. `mode` is `near` (run the files in the list) or `all`.
 * @param {{ mode: 'near' | 'all', list?: string }} plan
 */
export function nearOutputs(plan) {
  return [`mode=${plan.mode === 'near' ? 'near' : 'all'}`, `list=${plan.mode === 'near' ? (plan.list ?? '') : ''}`]
}

/** The words the step prints. */
export function nearWords({ total, near, readers, selected }) {
  return `${selected} of ${total} tests: ${near} near the change, ${readers} that read files${near + readers > selected ? ` (${near + readers - selected} are both)` : ''}`
}
