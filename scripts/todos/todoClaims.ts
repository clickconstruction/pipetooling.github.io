/**
 * The punch-list numbers other branches hold (docs/SESSIONS.md, v2.5998): the `todo-<N>`
 * claims on GitHub (`refs/claims/todo-<N>`, fetched afresh here unless CI, else as last fetched)
 * and the local mirror in the MAIN checkout's gitignored `.claude/sessions/claims/`. `check:todos`
 * adds them to the numbers git remembers, so the next free number it prints is past every claim;
 * `npm run claim -- --todo` is what reserves one. Nothing here writes.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseClaimRefs } from '../../src/lib/sessionClaims'

export function readClaimedTodoNumbers(root: string, opts: { fetch?: boolean } = {}): { numbers: number[]; fetched: boolean } {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const numbers = new Set<number>()
  let fetched = false
  if (opts.fetch ?? !process.env.CI) {
    try {
      execFileSync('git', ['fetch', '-q', '--prune', 'origin', '+refs/claims/*:refs/claims/*'], {
        cwd: root,
        stdio: 'ignore',
        timeout: 15000,
      })
      fetched = true
    } catch {
      // offline: the last-fetched refs and the local mirror still answer
    }
  }
  try {
    for (const c of parseClaimRefs(git('for-each-ref', '--format=%(objectname) %(refname)', 'refs/claims/'))) {
      if (c.todo != null) numbers.add(c.todo)
    }
  } catch {
    // not a git checkout: the local mirror alone answers
  }
  try {
    const common = git('rev-parse', '--git-common-dir')
    const claimsDir = join(dirname(isAbsolute(common) ? common : resolve(root, common)), '.claude', 'sessions', 'claims')
    if (existsSync(claimsDir)) {
      for (const f of readdirSync(claimsDir)) {
        const m = /^todo-(\d{1,3})\.json$/.exec(f)
        if (m) numbers.add(Number(m[1]))
      }
    }
  } catch {
    // same
  }
  return { numbers: [...numbers].sort((a, b) => a - b), fetched }
}
