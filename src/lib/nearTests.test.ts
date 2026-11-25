import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
// @ts-expect-error — ci.yml runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/nearTests.mjs'

/**
 * scripts/lib/nearTests.mjs picks the tests a pull request's own CI run takes: the ones whose imports reach a
 * changed file, and every test whose imports reach a module that reads files. The merge queue runs the whole
 * suite, so a wrong pick here costs a queue entry, not main. These pin what counts as reading the disk, the
 * fail-safe verdicts, the pick itself, and the steps of ci.yml that act on its two outputs.
 */
type Pick = { near: string[]; readers: string[]; selected: string[] }
const k = kernel as {
  PURE_BUILTINS: string[]
  DISK_PACKAGES: string[]
  WHOLE_SUITE_PATTERNS: RegExp[]
  packageOf: (s: string) => string
  readsDisk: (s: string, builtins?: Iterable<string>) => boolean
  snapshotOwner: (p: string) => string | null
  wholeSuiteReason: (changed: string[], opts?: { cap?: number }) => string | null
  nearTests: (input: { tests: string[]; importsOf: Map<string, string[]>; readerModules: string[]; changed: string[] }) => Pick
  nearOutputs: (plan: { mode: 'near' | 'all'; list?: string }) => string[]
  nearWords: (n: { total: number; near: number; readers: number; selected: number }) => string
}
const ROOT = join(__dirname, '..', '..')

describe('readsDisk', () => {
  it('says yes to the modules that open files, with or without node:', () => {
    for (const s of ['node:fs', 'fs', 'node:fs/promises', 'fs/promises', 'node:child_process', 'child_process', 'node:module', 'node:worker_threads', 'node:vm']) {
      expect(k.readsDisk(s, builtinModules), s).toBe(true)
    }
  })
  it('says no to the built-ins that cannot', () => {
    for (const s of ['node:path', 'path', 'node:url', 'node:os', 'node:crypto', 'node:zlib', 'node:http', 'node:timers/promises', 'node:stream/web']) {
      expect(k.readsDisk(s, builtinModules), s).toBe(false)
    }
  })
  it('says yes to a built-in nobody has listed, so a new one is safe before it is', () => {
    expect(k.readsDisk('node:sqlite', builtinModules)).toBe(true)
    expect(k.readsDisk('node:something_new', [])).toBe(true)
  })
  it('says yes to a compiler, a bundler and a globber by its package, whatever the subpath', () => {
    for (const s of ['typescript', 'typescript/lib/tsserverlibrary', 'esbuild', 'vite', 'eslint', '@playwright/test', 'fast-glob']) {
      expect(k.readsDisk(s, builtinModules), s).toBe(true)
    }
  })
  it('says yes to a virtual module, which a plugin writes from files on disk', () => {
    expect(k.readsDisk('/@id/__x00__virtual:punch-list', builtinModules)).toBe(true)
    expect(k.readsDisk('/@vite-plugin-pwa/virtual:pwa-register', builtinModules)).toBe(true)
    expect(k.readsDisk('virtual:app-version', builtinModules)).toBe(true)
  })
  it('says no to the app’s own packages, to a file and to an edge function’s Deno import', () => {
    for (const s of ['react', 'react-dom/server', '@supabase/supabase-js', 'vitest', '@testing-library/react', 'pdf-lib', 'exceljs', '/src/lib/jobs/lienDesk.ts', './sibling', '../up', 'npm:unpdf@2.1.0', 'https://esm.sh/x', '']) {
      expect(k.readsDisk(s, builtinModules), s).toBe(false)
    }
  })
  it('reads a package’s name off a specifier', () => {
    expect(k.packageOf('typescript/lib/x')).toBe('typescript')
    expect(k.packageOf('@playwright/test/reporter')).toBe('@playwright/test')
  })
})

describe('wholeSuiteReason', () => {
  it('is null for an ordinary change', () => {
    expect(k.wholeSuiteReason(['src/lib/jobs/lienDesk.ts', 'docs/GLOSSARY.md', 'supabase/functions/drive-link/index.ts', '.github/workflows/deploy.yml', 'scripts/check-todos.ts'])).toBeNull()
  })
  it('runs everything when the change is to what every test runs on, and names the file', () => {
    for (const f of ['package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.tests-lib.json', '.npmrc']) {
      expect(k.wholeSuiteReason(['src/a.ts', f]), f).toContain(f)
    }
  })
  it('runs everything when the change is to what picks the tests', () => {
    for (const f of ['.github/workflows/ci.yml', 'scripts/ci-near-tests.mjs', 'scripts/lib/nearTests.mjs', 'scripts/ci-docs-only.mjs', 'scripts/lib/docsOnlyChange.mjs']) {
      expect(k.wholeSuiteReason(['src/a.ts', f]), f).toContain(f)
    }
  })
  it('does not take a nested file of the same name for the root one', () => {
    expect(k.wholeSuiteReason(['supabase/functions/x/package.json', 'scripts/cloudflare/tsconfig.json'])).toBeNull()
  })
  it('runs everything with no files, with an empty name, or with the list at the compare cap', () => {
    expect(k.wholeSuiteReason([])).toContain('no files')
    expect(k.wholeSuiteReason([''])).toContain('no files')
    const many = Array.from({ length: 300 }, (_, i) => `src/f${i}.ts`)
    expect(k.wholeSuiteReason(many)).toContain('cap')
    expect(k.wholeSuiteReason(many, { cap: 1000 })).toBeNull()
  })
})

describe('nearTests', () => {
  // a.test → a → shared ; b.test → b → shared ; scan.test → readSource (reads disk) ; lone.test imports nothing
  const tests = ['src/a.test.ts', 'src/b.test.ts', 'src/scan.test.ts', 'src/lone.test.ts', 'src/g/rough.test.ts']
  const importsOf = new Map<string, string[]>([
    ['src/a.test.ts', ['src/a.ts']],
    ['src/b.test.ts', ['src/b.ts']],
    ['src/scan.test.ts', ['src/test/readSource.ts']],
    ['src/lone.test.ts', []],
    ['src/g/rough.test.ts', []],
    ['src/a.ts', ['src/shared.ts']],
    ['src/b.ts', ['src/shared.ts', 'src/a.ts']], // and a cycle below
    ['src/shared.ts', ['src/b.ts']],
    ['src/test/readSource.ts', []],
  ])
  const pick = (changed: string[]) => k.nearTests({ tests, importsOf, readerModules: ['src/test/readSource.ts'], changed })

  it('takes the tests whose imports reach a changed file, however deep, and survives a cycle', () => {
    expect(pick(['src/shared.ts']).near).toEqual(['src/a.test.ts', 'src/b.test.ts'])
    expect(pick(['src/a.ts']).near).toEqual(['src/a.test.ts', 'src/b.test.ts'])
  })
  it('takes a changed test file itself', () => {
    expect(pick(['src/lone.test.ts']).near).toEqual(['src/lone.test.ts'])
  })
  it('takes every test that reaches a module that reads files, whatever changed', () => {
    const p = pick(['docs/GLOSSARY.md'])
    expect(p.near).toEqual([])
    expect(p.readers).toEqual(['src/scan.test.ts'])
    expect(p.selected).toEqual(['src/scan.test.ts'])
  })
  it('takes the test that owns a changed snapshot', () => {
    expect(k.snapshotOwner('src/g/__snapshots__/rough.test.ts.snap')).toBe('src/g/rough.test.ts')
    expect(k.snapshotOwner('__snapshots__/x.test.ts.snap')).toBe('x.test.ts')
    expect(k.snapshotOwner('src/g/rough.test.ts')).toBeNull()
    expect(pick(['src/g/__snapshots__/rough.test.ts.snap']).near).toEqual(['src/g/rough.test.ts'])
  })
  it('lists a test once when it is both near and a reader, sorted', () => {
    const p = pick(['src/test/readSource.ts', 'src/b.ts'])
    // shared.ts imports b.ts and a.ts imports shared.ts, so a change to b.ts reaches a.test.ts too
    expect(p.selected).toEqual(['src/a.test.ts', 'src/b.test.ts', 'src/scan.test.ts'])
    expect(p.near).toContain('src/scan.test.ts')
  })
  it('takes nothing near for a file no test imports', () => {
    expect(pick(['src/pages/Untested.tsx', 'supabase/migrations/20261125000000_x.sql']).near).toEqual([])
  })
})

describe('the outputs and the words', () => {
  it('writes the two outputs ci.yml reads', () => {
    expect(k.nearOutputs({ mode: 'near', list: '/tmp/near-tests.txt' })).toEqual(['mode=near', 'list=/tmp/near-tests.txt'])
    expect(k.nearOutputs({ mode: 'all' })).toEqual(['mode=all', 'list='])
  })
  it('says how many of each kind, and how many are both', () => {
    expect(k.nearWords({ total: 5940, near: 286, readers: 332, selected: 597 })).toBe('597 of 5940 tests: 286 near the change, 332 that read files (21 are both)')
    expect(k.nearWords({ total: 10, near: 1, readers: 2, selected: 3 })).toBe('3 of 10 tests: 1 near the change, 2 that read files')
  })
})

describe('the workflow', () => {
  const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')
  it('picks on a pull request alone, and runs the pick or the whole suite by the picker’s answer', () => {
    expect(ci).toContain('run: node scripts/ci-near-tests.mjs "$RUNNER_TEMP/near-tests.txt" < "$RUNNER_TEMP/compare.json"')
    expect(ci).toContain("if: github.event_name == 'pull_request' && steps.changed.outputs.docs_only != 'true' && steps.near.outputs.mode == 'near'")
    expect(ci).toContain('run: npx vitest run $(cat "$RUNNER_TEMP/near-tests.txt")')
    expect(ci).toContain("if: github.event_name == 'pull_request' && steps.changed.outputs.docs_only != 'true' && steps.near.outputs.mode != 'near'")
  })
  it('the merge queue never picks: its legs are shards of the whole suite', () => {
    expect(ci).toContain("if: github.event_name != 'pull_request' && steps.changed.outputs.docs_only != 'true'")
    expect(ci).toContain('run: npx vitest run --shard=${{ matrix.part }}')
  })
  it('the script that builds the graph treats what it cannot tell as the whole suite', () => {
    const script = readFileSync(join(ROOT, 'scripts/ci-near-tests.mjs'), 'utf8')
    for (const words of ['the compare did not read', 'the import graph did not build', 'the picker itself failed', 'the graph did not list']) {
      expect(script, words).toContain(words)
    }
  })
})
