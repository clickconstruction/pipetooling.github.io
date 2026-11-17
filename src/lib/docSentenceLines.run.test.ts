import { afterAll, describe, expect, it, vi } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * scripts/codemods/doc-sentence-lines.mjs --resolve, run in a scratch repo (v2.7498). A branch cut before the
 * sweep amends one sentence of a one-line entry; main splits the entry a sentence a line and amends another
 * sentence of it. However the branch then merges main (git stopping on the doc, `-X ours` part way, `-X ours`
 * committed), --resolve must leave both amendments in, a sentence a line, stop on two changes to one sentence,
 * and never write over a change made to the doc after the merge.
 */
vi.setConfig({ testTimeout: 30_000 }) // each case runs a dozen git commands and node; a slow runner needs more than 5 s
const CLI = join(__dirname, '..', '..', 'scripts', 'codemods', 'doc-sentence-lines.mjs')
const DOC = 'doc.md'

const BASE = '# Terms\n\nThe run prints the notices. The desk mails them. The office records the numbers.\n'
const BRANCH = '# Terms\n\nThe run prints the notices, one per envelope. The desk mails them. The office records the numbers.\n'
const MAIN = '# Terms\n\nThe run prints the notices.\nThe desk mails them.\nThe office records the numbers, with the date.\n'
const BOTH = '# Terms\n\nThe run prints the notices, one per envelope.\nThe desk mails them.\nThe office records the numbers, with the date.\n'

// A repo of its own: none of this machine's git settings, and no GIT_DIR from a hook that runs the tests.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.test',
}
const dirs: string[] = []
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })))

function run(cwd: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd, env, encoding: 'utf8' })
  return { status: r.status, out: `${r.stdout}${r.stderr}` }
}

/** base → branch (one sentence amended on the one line) and base → main (split, another sentence amended). */
function bed(main = MAIN): string {
  const dir = mkdtempSync(join(tmpdir(), 'pt-doc-lines-'))
  dirs.push(dir)
  const git = (...args: string[]) => run(dir, 'git', args)
  git('init', '-q', '-b', 'main')
  writeFileSync(join(dir, DOC), BASE)
  git('add', DOC)
  git('commit', '-q', '-m', 'base')
  git('checkout', '-q', '-b', 'branch')
  writeFileSync(join(dir, DOC), BRANCH)
  git('commit', '-q', '-am', 'branch')
  git('checkout', '-q', 'main')
  writeFileSync(join(dir, DOC), main)
  git('commit', '-q', '-am', 'main')
  git('checkout', '-q', 'branch')
  return dir
}

const resolve = (dir: string) => run(dir, process.execPath, [CLI, '--resolve', DOC])
const doc = (dir: string) => readFileSync(join(dir, DOC), 'utf8')
const staged = (dir: string) => run(dir, 'git', ['diff', '--cached', '--name-only']).out.trim()

describe('doc-sentence-lines --resolve', () => {
  it('merges a doc git stopped on, a sentence a line, and a second run finds nothing to do', () => {
    const dir = bed()
    expect(run(dir, 'git', ['merge', '-q', 'main']).status).not.toBe(0)
    const first = resolve(dir)
    expect(first.status).toBe(0)
    expect(doc(dir)).toBe(BOTH)
    expect(staged(dir)).toBe(DOC)
    const second = resolve(dir)
    expect(second.status).toBe(0)
    expect(second.out).toContain('Nothing to resolve')
  })

  it('merges again a doc that `-X ours` settled, while the merge is still open', () => {
    const dir = bed()
    expect(run(dir, 'git', ['merge', '-q', '-X', 'ours', '--no-commit', 'main']).status).toBe(0)
    expect(doc(dir)).toBe(BRANCH) // main's amendment is gone: the branch's one line won whole
    const r = resolve(dir)
    expect(r.status).toBe(0)
    expect(doc(dir)).toBe(BOTH)
    expect(staged(dir)).toBe(DOC)
  })

  it('merges again a doc that `-X ours` settled in a merge already committed', () => {
    const dir = bed()
    expect(run(dir, 'git', ['merge', '-q', '-X', 'ours', '--no-edit', 'main']).status).toBe(0)
    expect(doc(dir)).toBe(BRANCH)
    const r = resolve(dir)
    expect(r.status).toBe(0)
    expect(doc(dir)).toBe(BOTH)
    expect(staged(dir)).toBe(DOC)
    expect(r.out).toContain('commit these docs on top of it')
  })

  it('marks two changes to one sentence for a hand and stages nothing', () => {
    const dir = bed('# Terms\n\nThe run prints the notices, two per page.\nThe desk mails them.\nThe office records the numbers.\n')
    expect(run(dir, 'git', ['merge', '-q', '-X', 'ours', '--no-edit', 'main']).status).toBe(0)
    const r = resolve(dir)
    expect(r.status).toBe(1)
    expect(doc(dir)).toContain('<<<<<<< ours\nThe run prints the notices, one per envelope.\n=======\nThe run prints the notices, two per page.\n>>>>>>> theirs\n')
    expect(staged(dir)).toBe('')
  })

  it('leaves a doc changed since the merge to a hand', () => {
    const dir = bed()
    expect(run(dir, 'git', ['merge', '-q', '-X', 'ours', '--no-edit', 'main']).status).toBe(0)
    const edited = `${BRANCH}\nA note written after the merge. It stays.\n`
    writeFileSync(join(dir, DOC), edited)
    const r = resolve(dir)
    expect(r.status).toBe(1)
    expect(r.out).toContain('changed since the merge')
    expect(doc(dir)).toBe(edited)
  })
})
