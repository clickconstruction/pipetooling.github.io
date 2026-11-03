import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — ci.yml runs the kernel on bare Node right after npm ci, so it is plain JS with no types
import * as kernel from '../../scripts/lib/docsOnlyChange.mjs'

/**
 * scripts/lib/docsOnlyChange.mjs lets a CI build whose every file is documentation run only the tests that read
 * the docs. These pin the patterns, the fail-safe verdicts, the outputs ci.yml reads, and that the list of
 * doc-reading tests names real files and every module that reads docs from disk.
 */
type Verdict = { docsOnly: boolean; reason: string; outside: string[] }
const k = kernel as {
  DOCS_ONLY_PATTERNS: RegExp[]
  DOC_READING_TESTS: string[]
  COMPARE_FILE_CAP: number
  isDocFile: (p: string) => boolean
  docsOnlyVerdict: (files: string[], opts?: { cap?: number }) => Verdict
  docsOnlyOutputs: (v: Verdict) => string[]
  filesOfCompare: (body: unknown) => string[]
}
const ROOT = join(__dirname, '..', '..')

describe('isDocFile', () => {
  it('counts docs, to-dos, root notes, .claude and a release note as docs', () => {
    for (const p of [
      'docs/GLOSSARY.md',
      'docs/recent-features/v2.6395.md',
      'docs/migrations/20261102003938_fixture_line_budgets.md',
      'docs/twins/APP_DIRECTORY.md',
      'to-dos/README.md',
      'to-dos/job-photos/mockup.html',
      'CLAUDE.md',
      'AGENTS.md',
      '.claude/sessions/active/card.md',
      'src/content/releaseNotes/v2.6395.ts',
    ]) {
      expect(k.isDocFile(p), p).toBe(true)
    }
  })
  it('counts the app, its tests, help guides, migrations, functions and workflows as code', () => {
    for (const p of [
      'src/lib/jobs/lienDesk.ts',
      'src/lib/docsOnlyChange.test.ts',
      'src/content/help/bill-a-customer.md', // a guide: the guide tests read it
      'src/content/releaseNotes.ts', // the frozen aggregator, not a note
      'supabase/migrations/20261102003938_fixture_line_budgets.sql',
      'supabase/functions/drive-link/index.ts',
      '.github/workflows/ci.yml',
      'scripts/lib/docsOnlyChange.mjs',
      'package.json',
      'public/help/clip.gif',
    ]) {
      expect(k.isDocFile(p), p).toBe(false)
    }
  })
})

describe('docsOnlyVerdict', () => {
  it('is docs-only when every file is a doc', () => {
    const v = k.docsOnlyVerdict(['docs/GLOSSARY.md', 'to-dos/README.md', 'src/content/releaseNotes/v2.6395.ts'])
    expect(v.docsOnly).toBe(true)
    expect(v.outside).toEqual([])
    expect(v.reason).toContain('3 files')
  })
  it('runs everything when one file is code, and names it', () => {
    const v = k.docsOnlyVerdict(['docs/GLOSSARY.md', 'src/lib/jobs/lienDesk.ts'])
    expect(v.docsOnly).toBe(false)
    expect(v.outside).toEqual(['src/lib/jobs/lienDesk.ts'])
    expect(v.reason).toContain('src/lib/jobs/lienDesk.ts')
  })
  it('runs everything with no files, with an empty name, or with the list at the cap', () => {
    expect(k.docsOnlyVerdict([]).docsOnly).toBe(false)
    expect(k.docsOnlyVerdict([''] as string[]).docsOnly).toBe(false)
    const many = Array.from({ length: 300 }, (_, i) => `docs/f${i}.md`)
    expect(k.docsOnlyVerdict(many).docsOnly).toBe(false)
    expect(k.docsOnlyVerdict(many).reason).toContain('cap')
    expect(k.docsOnlyVerdict(many, { cap: 1000 }).docsOnly).toBe(true)
  })
  it('shows at most five code files and counts the rest', () => {
    const v = k.docsOnlyVerdict(Array.from({ length: 8 }, (_, i) => `src/a${i}.ts`))
    expect(v.reason).toContain('and 3 more')
  })
})

describe('the compare body and the outputs', () => {
  it('reads file names and a rename’s old name, and nothing from a non-body', () => {
    expect(
      k.filesOfCompare({ files: [{ filename: 'docs/a.md' }, { filename: 'docs/b.md', previous_filename: 'src/x.ts' }] }),
    ).toEqual(['docs/a.md', 'docs/b.md', 'src/x.ts'])
    expect(k.filesOfCompare(null)).toEqual([])
    expect(k.filesOfCompare({ message: 'Not Found' })).toEqual([])
  })
  it('writes the two outputs ci.yml reads', () => {
    const lines = k.docsOnlyOutputs(k.docsOnlyVerdict(['docs/a.md']))
    expect(lines[0]).toBe('docs_only=true')
    expect(lines[1]).toBe(`doc_tests=${k.DOC_READING_TESTS.join(' ')}`)
    expect(k.docsOnlyOutputs(k.docsOnlyVerdict(['src/a.ts']))[0]).toBe('docs_only=false')
  })
})

describe('the doc-reading tests', () => {
  it('every listed test exists', () => {
    for (const t of k.DOC_READING_TESTS) expect(existsSync(join(ROOT, t)), t).toBe(true)
  })
  it('every module that reads docs, to-dos or .claude from disk has its test on the list', () => {
    // The readers today; a new one joins this list and DOC_READING_TESTS together.
    const readers: Record<string, string> = {
      'src/lib/releaseNotes.ts': 'src/lib/releaseNotes.test.ts',
      'src/lib/twins/appDirectoryCheck.ts': 'src/lib/twins/appDirectoryCheck.test.ts',
      'src/lib/todos/punchListView.ts': 'src/lib/todos/punchListView.test.ts',
      'src/lib/todos/todoBoard.ts': 'src/lib/todos/todoBoard.test.ts',
      'src/lib/sessionClaims.ts': 'src/lib/sessionClaims.test.ts',
    }
    for (const [mod, test] of Object.entries(readers)) {
      const source = readFileSync(join(ROOT, mod), 'utf8')
      expect(/docs\/|to-dos\/|\.claude\/|recent-features|releaseNotes/.test(source), mod).toBe(true)
      expect(k.DOC_READING_TESTS, mod).toContain(test)
    }
  })
  it('the workflow runs the doc readers from the step’s output, not from a second list', () => {
    const ci = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8')
    expect(ci).toContain('node scripts/ci-docs-only.mjs')
    expect(ci).toContain("if: steps.changed.outputs.docs_only != 'true'")
    expect(ci).toContain('npx vitest run ${{ steps.changed.outputs.doc_tests }}')
  })
})
