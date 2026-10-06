import { describe, expect, it } from 'vitest'
// @ts-expect-error — the drift check runs on bare Node in CI, so its kernel is plain JS with no types
import * as kernel from '../../scripts/lib/edgeBundle.mjs'

/**
 * scripts/lib/edgeBundle.mjs decides what scripts/check-edge-function-drift.mjs calls a function's
 * code: index.ts plus every file it imports at run time. These pin the import reading, the walk,
 * the git-log parsing and the deployed-vs-repo verdicts.
 */
type Commit = { ms: number; hash: string; subject: string }
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
  historyBlobIds: (gitRawLog: string) => Set<string>
  gitBlobId: (bytes: string | Uint8Array) => string
  compareBundles: (repo: Map<string, string>, deployed: Map<string, string>, historyBlobs: Set<string>) => Verdict
  configVerifyJwt: (configToml: string, slugs: string[]) => Map<string, boolean>
}

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
