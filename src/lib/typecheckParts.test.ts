import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
// @ts-expect-error — scripts/typecheck-queued.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/typecheckParts.mjs'

/**
 * scripts/lib/typecheckParts.mjs names the three programs `npm run typecheck` checks `src` in (punch list
 * #434, PR 1). These hold that no file under `src` falls outside the three, that each part checks under the
 * whole program's own options, the words and the exit code, and the wiring of the wrapper, the build and the
 * two workflows' cache key.
 */
type Part = { name: string; config: string; what: string }
type Result = { part: Part; code: number }
const k = kernel as {
  PARTS: Part[]
  BUILD_PART: Part
  partWords: (o: { index: number; part: Part; total?: number }) => string
  worstExit: (codes: number[]) => number
  stoppedByHand: (code: number) => boolean
  outcomeWords: (results: Result[], total?: number) => string
}

const repo = join(__dirname, '..', '..')
const read = (...parts: string[]) => readFileSync(join(repo, ...parts), 'utf8')

/** A tsconfig at the repo root as tsc itself reads it: its root files (repo-relative) and its options. */
function parsed(config: string) {
  const file = join(repo, config)
  const raw = ts.readConfigFile(file, ts.sys.readFile)
  expect(raw.error, `${config} reads`).toBeUndefined()
  const out = ts.parseJsonConfigFileContent(raw.config, ts.sys, repo, undefined, file)
  expect(out.errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, '\n')), `${config} parses`).toEqual([])
  return { files: out.fileNames.map((f) => relative(repo, f)), options: out.options, extendsFrom: (raw.config as { extends?: string }).extends }
}

const isTest = (f: string) => /\.test\.tsx?$/.test(f)
const whole = parsed('tsconfig.json')
const parts = k.PARTS.map((part) => ({ part, ...parsed(part.config) }))
const [app, testsLib, testsRest] = parts as [(typeof parts)[number], (typeof parts)[number], (typeof parts)[number]]

describe('typecheckParts: the three programs cover src', () => {
  it('there are three, in the order they run, and the build checks the first', () => {
    expect(k.PARTS.map((p) => p.name)).toEqual(['app', 'tests-lib', 'tests-rest'])
    expect(k.PARTS.map((p) => p.config)).toEqual(['tsconfig.app.json', 'tsconfig.tests-lib.json', 'tsconfig.tests-rest.json'])
    expect(k.BUILD_PART).toBe(k.PARTS[0])
  })

  it("every file the whole program checks is a root file of at least one part, and no part names a file the whole program does not", () => {
    expect(whole.files.length).toBeGreaterThan(10000)
    const union = new Set(parts.flatMap((p) => p.files))
    expect(whole.files.filter((f) => !union.has(f))).toEqual([])
    const all = new Set(whole.files)
    expect([...union].filter((f) => !all.has(f))).toEqual([])
  })

  it('the app part holds every file that is not a test and no test; each test is in exactly one test part', () => {
    expect(app.files.filter(isTest)).toEqual([])
    expect(new Set(app.files)).toEqual(new Set(whole.files.filter((f) => !isTest(f))))
    const lib = new Set(testsLib.files.filter(isTest))
    const rest = new Set(testsRest.files.filter(isTest))
    expect([...lib].filter((f) => !f.startsWith('src/lib/'))).toEqual([])
    expect([...rest].filter((f) => f.startsWith('src/lib/'))).toEqual([])
    expect([...lib].filter((f) => rest.has(f))).toEqual([])
    expect(lib.size + rest.size).toBe(whole.files.filter(isTest).length)
  })

  it('a test part names tests and declaration files alone, so what else it checks is what its tests import', () => {
    for (const p of [testsLib, testsRest]) {
      expect(p.files.filter((f) => !isTest(f) && !f.endsWith('.d.ts')), p.part.config).toEqual([])
      // Every declaration file under src rides with each test part: a test may lean on an ambient name.
      expect(p.files.filter((f) => f.endsWith('.d.ts')).sort(), p.part.config).toEqual(whole.files.filter((f) => f.endsWith('.d.ts')).sort())
    }
  })

  it('an ambient declaration lives in a declaration file, never inside a module one part might not load', () => {
    // `declare global` inside src/lib/lens/seal.ts was known to the whole program and missing from the
    // tests-outside-lib part, which read `window.__lens` in two files that do not import the seal (2026-11-24).
    const ambient = /^\s*declare\s+(global\b|module\s+['"])/m
    const inModules = whole.files.filter((f) => !f.endsWith('.d.ts')).filter((f) => {
      const text = read(f)
      return text.includes('declare') && ambient.test(text)
    })
    expect(inModules).toEqual([])
    // It reads every file under src once: five seconds on a dev Mac, so it has its own limit.
  }, 120_000)

  it("each part extends tsconfig.json and checks under its options, with a build-info file of its own", () => {
    const same = (o: ts.CompilerOptions) => {
      const { tsBuildInfoFile: _info, configFilePath: _path, ...rest } = o
      return rest
    }
    const infos = parts.map((p) => relative(repo, String(p.options.tsBuildInfoFile)))
    for (const p of parts) {
      expect(p.extendsFrom, p.part.config).toBe('./tsconfig.json')
      expect(same(p.options), p.part.config).toEqual(same(whole.options))
    }
    expect(infos).toEqual(['.cache/typecheck/app.tsbuildinfo', '.cache/typecheck/tests-lib.tsbuildinfo', '.cache/typecheck/tests-rest.tsbuildinfo'])
    expect(infos).not.toContain(relative(repo, String(whole.options.tsBuildInfoFile)))
  })
})

describe('typecheckParts: the words and the exit code', () => {
  const [a, b, c] = k.PARTS as [Part, Part, Part]

  it('names the part before it runs', () => {
    expect(k.partWords({ index: 0, part: a })).toBe('typecheck: part 1 of 3, src without its tests (tsconfig.app.json).')
    expect(k.partWords({ index: 2, part: c })).toBe('typecheck: part 3 of 3, the tests outside src/lib and what they import (tsconfig.tests-rest.json).')
  })

  it("the exit code is the worst part's, and 0 only when every part is clean", () => {
    expect(k.worstExit([0, 0, 0])).toBe(0)
    expect(k.worstExit([0, 2, 0])).toBe(2)
    expect(k.worstExit([2, 134, 0])).toBe(134)
    expect(k.worstExit([0, 1, 2])).toBe(2)
    expect(k.worstExit([])).toBe(1)
    expect(k.worstExit([0, Number.NaN])).toBe(1)
  })

  it('only a Ctrl-C or a terminate stops the parts that follow; errors and a heap death do not', () => {
    expect(k.stoppedByHand(130)).toBe(true)
    expect(k.stoppedByHand(143)).toBe(true)
    for (const code of [0, 1, 2, 134, 137]) expect(k.stoppedByHand(code)).toBe(false)
  })

  it('the last line says which parts were clean, which had errors, which gave no verdict and how many never ran', () => {
    expect(k.outcomeWords([{ part: a, code: 0 }, { part: b, code: 0 }, { part: c, code: 0 }])).toBe('typecheck: all 3 parts are clean.')
    expect(k.outcomeWords([{ part: a, code: 0 }, { part: b, code: 2 }, { part: c, code: 0 }])).toBe('typecheck: 2 of 3 parts clean; with errors: tests-lib.')
    expect(k.outcomeWords([{ part: a, code: 134 }, { part: b, code: 0 }, { part: c, code: 2 }])).toBe(
      'typecheck: 1 of 3 parts clean; with errors: tests-rest; NO VERDICT: app (exit 134).',
    )
    expect(k.outcomeWords([{ part: a, code: 0 }, { part: b, code: 130 }])).toBe('typecheck: 1 of 3 parts clean; NO VERDICT: tests-lib (exit 130); not run: 1.')
  })
})

describe('typecheckParts: the wiring', () => {
  it('the wrapper runs every part through the one runner and keeps going past a part that fails', () => {
    const wrapper = read('scripts', 'typecheck-queued.mjs')
    expect(wrapper).toContain('for (const [index, part] of PARTS.entries())')
    expect(wrapper).toContain("runTscUnderHeap('typecheck', ['-p', part.config, ...process.argv.slice(2)], { label: part.name })")
    expect(wrapper).toContain('if (stoppedByHand(code)) break')
    expect(wrapper).toContain('return worstExit(results.map((r) => r.code))')
    // The whole program's config is for editors: the check never runs it.
    expect(wrapper).not.toMatch(/'-p', 'tsconfig\.json'/)
  })

  it('the build checks the app part alone', () => {
    expect(read('scripts', 'tsc-build.mjs')).toContain("runTsc('build', ['-b', BUILD_PART.config, ...process.argv.slice(2)], { label: BUILD_PART.name })")
  })

  it("both workflows' cache key carries every part's config, so a changed include list starts a fresh cache", () => {
    for (const file of ['ci.yml', 'warm-caches.yml']) {
      const keys = read('.github', 'workflows', file)
        .split('\n')
        .filter((l) => l.includes('checks-cache-') && l.includes('hashFiles('))
      expect(keys.length, `${file} has cache keys`).toBeGreaterThanOrEqual(2)
      for (const line of keys) for (const config of ['tsconfig.json', ...k.PARTS.map((p) => p.config)]) expect(line, `${file}: ${config}`).toContain(`'${config}'`)
    }
  })
})
