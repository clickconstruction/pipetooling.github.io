import { afterAll, describe, expect, it } from 'vitest'
import * as esbuild from 'esbuild'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
// @ts-expect-error — the drift check runs on bare Node in CI, so its kernel is plain JS with no types
import * as kernel from '../../scripts/lib/edgeBundle.mjs'

/**
 * scripts/lib/edgeBundle.mjs decides what scripts/check-edge-function-drift.mjs calls a function's
 * code: index.ts plus every file it imports at run time. These pin the import reading, the walk,
 * the git-log parsing and the deployed-vs-repo verdicts.
 */
type Commit = { ms: number; hash: string; subject: string; builtMs?: number }
type Verdict = { state: string; changed: string[]; added: string[]; dropped: string[]; foreign: string[] }
const k = kernel as {
  runtimeImportSpecifiers: (source: string) => string[]
  walkBundle: (
    root: string,
    entry: string,
    io: { readFile: (p: string) => string; exists: (p: string) => boolean },
  ) => { files: string[]; unresolved: string[] }
  commitsByFile: (gitLog: string) => Map<string, Commit[]>
  commitsSince: (files: string[], byFile: Map<string, Commit[]>, sinceMs: number) => Commit[]
  pullNumberOf: (subject: string) => number | null
  commitsToLand: (byFile: Map<string, Commit[]>, deployedMs: number[], windowMs: number) => { hash: string; pull: number }[]
  withLandingTimes: (byFile: Map<string, Commit[]>, landedMs: (c: Commit) => number | null) => Map<string, Commit[]>
  historyBlobIds: (gitRawLog: string) => Set<string>
  gitBlobId: (bytes: string | Uint8Array) => string
  compareBundles: (repo: Map<string, string>, deployed: Map<string, string>, historyBlobs: Set<string>) => Verdict
  configVerifyJwt: (configToml: string, slugs: string[]) => Map<string, boolean>
  linkFunctions: (root: string, dir: string, slugs: string[], esbuild: unknown) => Promise<LinkResult[]>
  linkReport: (results: LinkResult[], dir: string) => { failed: string[]; lines: string[]; warnings: string[] }
}
type LinkMessage = { file: string | null; line: number | null; text: string }
type LinkResult = { slug: string; errors: LinkMessage[]; warnings: LinkMessage[] }

describe('runtimeImportSpecifiers', () => {
  it.each([
    ["import { a } from './a.ts'", ['./a.ts']],
    ["import {\n  a,\n  b,\n} from './ml.ts'", ['./ml.ts']],
    ["import { type A, b } from './mixed.ts'", ['./mixed.ts']],
    ["export * from './star.ts'", ['./star.ts']],
    ["import './side.ts'", ['./side.ts']],
    ["const m = await import('./dyn.ts')", ['./dyn.ts']],
    ["import type from './named-type.ts'", ['./named-type.ts']],
  ])('keeps a run-time import: %j', (source, expected) => {
    expect(k.runtimeImportSpecifiers(source)).toEqual(expected)
  })

  it.each([
    "import type { A } from './t.ts'",
    "import type {\n  A,\n  B,\n} from './t.ts'",
    "export type { A } from './t.ts'",
    "// import { x } from './commented.ts'",
  ])('drops what never reaches the bundle: %j', (source) => {
    expect(k.runtimeImportSpecifiers(source)).toEqual([])
  })

  it('does not let a type alias swallow the import after it', () => {
    const source = "export type Row = {\n  a: number\n}\nimport { x } from './x.ts'\n"
    expect(k.runtimeImportSpecifiers(source)).toEqual(['./x.ts'])
  })
})

/**
 * linkFunctions is the check behind `npm run check:edge-bundles` (ci.yml, every PR): esbuild links each
 * function as Deno's loader will at boot. The fixture is a functions folder in a temp directory, with a
 * `_shared` module two functions import; v2.6294 is the break it must catch.
 */
describe('linkFunctions', () => {
  const root = mkdtempSync(join(tmpdir(), 'edge-link-'))
  const dir = 'supabase/functions'
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), source)
  }
  write(`${dir}/_shared/settings.ts`, 'export const meta = 1\nexport type Meta = { id: string }\n')
  write(
    `${dir}/folders/index.ts`,
    [
      "import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'",
      "import { meta, metaOwner } from '../_shared/settings.ts'",
      'serve(() => new Response(String(meta) + String(metaOwner)))',
      '',
    ].join('\n'),
  )
  write(
    `${dir}/clean/index.ts`,
    [
      "import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'",
      "import webpush from 'npm:web-push@3.6.7'",
      "import { meta, type Nope } from '../_shared/settings.ts'",
      "import type { Gone } from '../_shared/settings.ts'",
      'const a: Nope | Gone | null = null',
      'export default { meta, createClient, webpush, a }',
      '',
    ].join('\n'),
  )
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const one = (results: LinkResult[], slug: string): LinkResult => {
    const r = results.find((x) => x.slug === slug)
    if (!r) throw new Error(`no result for ${slug}`)
    return r
  }

  it('fails a value import of a name the module does not export, at the importer’s line', async () => {
    const folders = one(await k.linkFunctions(root, dir, ['folders'], esbuild), 'folders')
    expect(folders.errors).toEqual([
      {
        file: `${dir}/folders/index.ts`,
        line: 2,
        text: expect.stringMatching(/No matching export .*settings\.ts.* for import "metaOwner"/),
      },
    ])
  })

  it('passes a clean function: remote and npm: imports stay external, a type-only import of a missing name is stripped as Deno strips it', async () => {
    const clean = one(await k.linkFunctions(root, dir, ['clean'], esbuild), 'clean')
    expect(clean.errors).toEqual([])
    expect(clean.warnings).toEqual([])
  })

  it('linkReport names each failing function once per distinct message, paths shortened past the folder', async () => {
    const results = await k.linkFunctions(root, dir, ['clean', 'folders'], esbuild)
    const report = k.linkReport(results, dir)
    expect(report.failed).toEqual(['folders'])
    expect(report.lines).toEqual([
      expect.stringMatching(/^ {2}- folders\n {6}folders\/index\.ts:2 No matching export in "_shared\/settings\.ts" for import "metaOwner"$/),
    ])
    expect(report.warnings).toEqual([])
  })

  it('linkReport folds a repeated message and keeps a message with no location', () => {
    const m = { file: `${dir}/_shared/a.ts`, line: 4, text: 'No matching export in "x" for import "y"' }
    const report = k.linkReport(
      [
        { slug: 'one', errors: [m, { ...m }], warnings: [{ file: null, line: null, text: 'odd' }] },
        { slug: 'two', errors: [{ file: null, line: null, text: 'Could not resolve "./gone.ts"' }], warnings: [] },
      ],
      dir,
    )
    expect(report.failed).toEqual(['one', 'two'])
    expect(report.lines).toEqual([
      '  - one\n      _shared/a.ts:4 No matching export in "x" for import "y"',
      '  - two\n      Could not resolve "./gone.ts"',
    ])
    expect(report.warnings).toEqual(['one: odd'])
  })
})

describe('walkBundle', () => {
  const files: Record<string, string> = {
    '/repo/supabase/functions/fn/index.ts': [
      "import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'",
      "import { send } from '../_shared/send.ts'",
      "import type { Row } from '../_shared/types.ts'",
      "import { gone } from '../_shared/gone.ts'",
    ].join('\n'),
    '/repo/supabase/functions/_shared/send.ts': "import { from } from './from.ts'\nexport const send = 1",
    '/repo/supabase/functions/_shared/from.ts': "import { send } from './send.ts'\nexport const from = send",
    '/repo/supabase/functions/_shared/types.ts': 'export type Row = { a: number }',
  }
  const io = { readFile: (p: string) => files[p] ?? '', exists: (p: string) => p in files }

  it('follows relative run-time imports through _shared, once each', () => {
    const bundle = k.walkBundle('/repo', 'supabase/functions/fn/index.ts', io)
    expect(bundle.files).toEqual([
      'supabase/functions/_shared/from.ts',
      'supabase/functions/_shared/send.ts',
      'supabase/functions/fn/index.ts',
    ])
    expect(bundle.unresolved).toEqual(['supabase/functions/fn/index.ts -> ../_shared/gone.ts'])
  })
})

describe('commit history', () => {
  const log = [
    '@1700000300\tc3\tv2.3 the shared helper',
    'supabase/functions/_shared/send.ts',
    '',
    '@1700000200\tc2\tv2.2 the function and the helper',
    'supabase/functions/fn/index.ts',
    'supabase/functions/_shared/send.ts',
    '',
    '@1700000100\tc1\tv2.1 the function',
    'supabase/functions/fn/index.ts',
  ].join('\n')

  it('lists each file’s commits newest first', () => {
    const byFile = k.commitsByFile(log)
    expect(byFile.get('supabase/functions/_shared/send.ts')?.map((c) => c.hash)).toEqual(['c3', 'c2'])
    expect(byFile.get('supabase/functions/fn/index.ts')?.[1]).toEqual({ ms: 1700000100000, hash: 'c1', subject: 'v2.1 the function' })
  })

  it('names each commit since a deploy once, across the bundle', () => {
    const byFile = k.commitsByFile(log)
    const bundle = ['supabase/functions/fn/index.ts', 'supabase/functions/_shared/send.ts']
    expect(k.commitsSince(bundle, byFile, 1700000150000).map((c) => c.hash)).toEqual(['c3', 'c2'])
    expect(k.commitsSince(bundle, byFile, 1700000300000)).toEqual([])
  })

  it('collects every blob id the history named, never the zero id', () => {
    const raw = [
      `:000000 100644 ${'0'.repeat(40)} ${'a'.repeat(40)} A\tsupabase/functions/_shared/send.ts`,
      `:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\tsupabase/functions/_shared/send.ts`,
    ].join('\n')
    expect([...k.historyBlobIds(raw)].sort()).toEqual(['a'.repeat(40), 'b'.repeat(40)])
  })

  it('computes git’s own blob ids', () => {
    expect(k.gitBlobId('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391')
    expect(k.gitBlobId('hello\n')).toBe('ce013625030ba8dba906f756967f9e9ca394464a')
  })
})

/**
 * A commit's time is when it landed on main. On 2026-11-03 #6899's squash was built by the merge queue at
 * 10:07Z and landed at 10:35Z; drive-link was deployed at 10:18Z from a main without it, and git's times
 * called it current while its deployed bundle lacked the PR (v2.6452).
 */
describe('landing times', () => {
  const built = Date.UTC(2026, 10, 3, 10, 7, 32)
  const deployed = Date.UTC(2026, 10, 3, 10, 18, 21)
  const landed = Date.UTC(2026, 10, 3, 10, 35, 3)
  const earlier = Date.UTC(2026, 10, 3, 7, 36, 44) // #6920's squash, landed 09:00Z
  const earlierLanded = Date.UTC(2026, 10, 3, 9, 0, 59)
  const newer = Date.UTC(2026, 10, 3, 11, 0, 0) // after the deploy: a suspect by git's time alone
  const old = deployed - 30 * 3600 * 1000 // before the window
  const window = 24 * 3600 * 1000
  const sec = (ms: number) => Math.floor(ms / 1000)
  const log = [
    `@${sec(newer)}\tn1\tv2.6430 later work (#6944)`,
    'supabase/functions/_shared/other.ts',
    '',
    `@${sec(built)}\ta1\tv2.6417 the reconcile step (#6899)`,
    'supabase/functions/_shared/fileIndexCheckKernel.ts',
    'supabase/functions/file-index-sweep/index.ts',
    '',
    `@${sec(earlier)}\tb1\tv2.6338 search by meaning (#6920)`,
    'supabase/functions/file-index-sweep/index.ts',
    '',
    `@${sec(built - 60_000)}\tl1\tchore: a commit that names no pull`,
    'supabase/functions/_shared/fileIndexCheckKernel.ts',
    '',
    `@${sec(old)}\to1\tv2.6300 long before (#6700)`,
    'supabase/functions/_shared/fileIndexCheckKernel.ts',
  ].join('\n')
  const kernelFile = 'supabase/functions/_shared/fileIndexCheckKernel.ts'
  const sweepFile = 'supabase/functions/file-index-sweep/index.ts'
  const driveLink = ['supabase/functions/drive-link/index.ts', kernelFile]
  const byPull = (times: Map<number, number>) => (c: Commit) => times.get(k.pullNumberOf(c.subject) ?? -1) ?? null

  it('reads the pull a squash names at the end of its subject', () => {
    expect(k.pullNumberOf('v2.6417 the reconcile step (#6899)')).toBe(6899)
    expect(k.pullNumberOf('Revert "v2.1 x (#5)" (#7)')).toBe(7)
    expect(k.pullNumberOf('chore: a commit that names no pull')).toBeNull()
    expect(k.pullNumberOf('(#12) in front')).toBeNull()
  })

  it('asks only about the squashes built within the window before some deploy, each once, oldest pull first', () => {
    const byFile = k.commitsByFile(log)
    expect(k.commitsToLand(byFile, [deployed], window)).toEqual([
      { hash: 'a1', pull: 6899 },
      { hash: 'b1', pull: 6920 },
    ])
    // a deploy an hour after the old commit brings it in; one before it does not, since git's time already says newer
    expect(k.commitsToLand(byFile, [deployed, old + 3600 * 1000], window).map((t) => t.hash)).toEqual(['o1', 'a1', 'b1'])
    expect(k.commitsToLand(byFile, [deployed, old - 3600 * 1000], window).map((t) => t.hash)).toEqual(['a1', 'b1'])
    expect(k.commitsToLand(byFile, [], window)).toEqual([])
  })

  it('moves a commit to when it landed, never backwards, once for every file it touches', () => {
    const byFile = k.withLandingTimes(k.commitsByFile(log), byPull(new Map([[6899, landed], [6920, earlierLanded], [6944, newer - 1000]])))
    const kernelCommits = byFile.get(kernelFile) ?? []
    expect(kernelCommits.map((c) => c.hash)).toEqual(['a1', 'l1', 'o1'])
    expect(kernelCommits[0]).toEqual({ ms: landed, builtMs: built, hash: 'a1', subject: 'v2.6417 the reconcile step (#6899)' })
    expect(kernelCommits[1]?.builtMs).toBeUndefined()
    expect(byFile.get(sweepFile)?.[0]).toBe(kernelCommits[0])
    expect(byFile.get(sweepFile)?.map((c) => [c.hash, c.ms])).toEqual([
      ['a1', landed],
      ['b1', earlierLanded],
    ])
    const later = byFile.get('supabase/functions/_shared/other.ts')?.[0]
    expect(later?.ms).toBe(newer)
    expect(later?.builtMs).toBeUndefined()
  })

  it('the 2026-11-03 shape: built before the deploy and landed after it is a suspect; landed before it is not', () => {
    const byFile = k.withLandingTimes(k.commitsByFile(log), byPull(new Map([[6899, landed], [6920, earlierLanded]])))
    expect(k.commitsSince(driveLink, byFile, deployed).map((c) => c.hash)).toEqual(['a1'])
    expect(k.commitsSince([sweepFile], byFile, deployed).map((c) => c.hash)).toEqual(['a1'])
    expect(k.commitsSince(driveLink, k.commitsByFile(log), deployed)).toEqual([]) // git's times alone: the blind spot
  })

  it('a squash whose landing is not known is read as landed now, so the download decides', () => {
    const built0 = k.commitsByFile(log)
    const unlanded = new Set(k.commitsToLand(built0, [deployed], window).map((t) => t.hash))
    const now = deployed + 3600 * 1000
    const byFile = k.withLandingTimes(built0, (c) => (unlanded.has(c.hash) ? now : null))
    expect(k.commitsSince(driveLink, byFile, deployed).map((c) => c.hash)).toEqual(['a1'])
    expect(k.commitsSince([sweepFile], byFile, deployed).map((c) => c.hash).sort()).toEqual(['a1', 'b1'])
    expect(byFile.get(kernelFile)?.[2]?.ms).toBe(old)
  })
})

describe('compareBundles', () => {
  const now = new Map([
    ['supabase/functions/fn/index.ts', 'index v2\n'],
    ['supabase/functions/_shared/send.ts', 'send v2\n'],
  ])
  const history = new Set([k.gitBlobId('index v1\n'), k.gitBlobId('send v1\n'), k.gitBlobId('old.ts\n')])

  it('is current when every file matches, line endings aside', () => {
    const deployed = new Map([
      ['supabase/functions/fn/index.ts', 'index v2\r\n'],
      ['supabase/functions/_shared/send.ts', 'send v2\n'],
    ])
    expect(k.compareBundles(now, deployed, history).state).toBe('current')
  })

  it('is behind when the deploy holds an older version of a shared file', () => {
    const deployed = new Map([...now, ['supabase/functions/_shared/send.ts', 'send v1\n']])
    expect(k.compareBundles(now, deployed, history)).toMatchObject({ state: 'behind', changed: ['supabase/functions/_shared/send.ts'] })
  })

  it('is behind when the repo imports a file the deploy lacks, or the deploy kept one the repo dropped', () => {
    const lacking = new Map([['supabase/functions/fn/index.ts', 'index v2\n']])
    expect(k.compareBundles(now, lacking, history)).toMatchObject({ state: 'behind', added: ['supabase/functions/_shared/send.ts'] })
    const keeping = new Map([...now, ['supabase/functions/_shared/old.ts', 'old.ts\n']])
    expect(k.compareBundles(now, keeping, history)).toMatchObject({ state: 'behind', dropped: ['supabase/functions/_shared/old.ts'] })
  })

  it('is elsewhere when a deployed file never existed in this history', () => {
    const deployed = new Map([...now, ['supabase/functions/fn/index.ts', 'index from an open branch\n']])
    expect(k.compareBundles(now, deployed, history)).toMatchObject({ state: 'elsewhere', foreign: ['supabase/functions/fn/index.ts'] })
  })
})

describe('configVerifyJwt', () => {
  const toml = [
    '[api]',
    'enabled = true',
    '',
    '# Cron: X-Cron-Secret in the handler.',
    '[functions.cron-a]',
    'verify_jwt = false',
    '',
    '[functions.cron-b]',
    '# A header whose own line went missing reads as the default.',
    '[functions.portal]',
    'verify_jwt = false # token in the handler',
    '',
    '[functions."quoted-fn"]',
    'verify_jwt = true',
  ].join('\n')

  it('reads each block, and the CLI default where there is none', () => {
    const jwt = k.configVerifyJwt(toml, ['cron-a', 'cron-b', 'portal', 'quoted-fn', 'unlisted'])
    expect(Object.fromEntries(jwt)).toEqual({ 'cron-a': false, 'cron-b': true, portal: false, 'quoted-fn': true, unlisted: true })
  })
})
