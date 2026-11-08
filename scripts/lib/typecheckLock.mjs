/**
 * A machine-wide lock so the repo's full typecheck runs one at a time across worktrees.
 * Plain JS with no dependencies: scripts/typecheck-queued.mjs runs it on bare Node, and
 * src/lib/typecheckLock.test.ts pins it.
 *
 * On 2026-11-08 the Claude app had to be restarted for memory: two sessions' typechecks (tsc under
 * --max-old-space-size=10240) held about 9.5 GB each at the same moment, on top of the app's own 3.5 GB,
 * and nothing coordinated them. The lock is a directory — mkdir is atomic on every filesystem Node runs
 * on — holding one `holder.json` with the holder's pid, folder and start time. A waiter polls, says who
 * holds the lock every 30 seconds, and takes over a lock whose pid is dead: the takeover renames the stale
 * directory away first (atomic, so of two waiters only one wins the rename) and removes the renamed copy.
 * Release removes the directory only while `holder.json` still names the releasing pid, so a process that
 * lost its lock to a takeover never removes the next holder's.
 *
 * Where the lock lives: `$TYPECHECK_LOCK_DIR` when set; else `<main checkout>/.claude/sessions/locks/`
 * (gitignored, shared by every worktree of the repo through `git rev-parse --git-common-dir`, where the
 * version claims' local mirror lives too); else the OS temp folder. `TYPECHECK_NO_LOCK=1` skips the lock
 * (CI: each job is its own machine).
 */
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'

export const LOCK_DIR_NAME = 'typecheck.lock'
export const HOLDER_FILE = 'holder.json'
/** How often a waiter says who holds the lock. */
export const WAIT_LINE_EVERY_MS = 30_000
/** How often a waiter tries again. */
export const POLL_MS = 500
/** A lock directory with no readable holder.json younger than this is still being written; older, it is a leftover. */
export const UNWRITTEN_GRACE_MS = 10_000

/** The folder the lock directory sits in. `gitCommonDir` is `git rev-parse --git-common-dir`'s answer, or null when not in a repo. */
export function lockRoot({ env = {}, gitCommonDir = null, cwd = process.cwd(), tmp = tmpdir() } = {}) {
  if (env.TYPECHECK_LOCK_DIR) return env.TYPECHECK_LOCK_DIR
  if (gitCommonDir) {
    const common = isAbsolute(gitCommonDir) ? gitCommonDir : resolve(cwd, gitCommonDir)
    // `.git` of the main checkout, or `<main>/.git/worktrees/<name>` from inside a worktree; both end under the main checkout's .git.
    const mainRoot = dirname(common.replace(/[\\/]\.git[\\/]worktrees[\\/][^\\/]+$/, '/.git'))
    return join(mainRoot, '.claude', 'sessions', 'locks')
  }
  return join(tmp, 'pipetooling-locks')
}

/** What the holder writes into the lock directory. */
export function holderRecord({ pid, cwd, startedAt }) {
  return { pid, cwd, startedAt: new Date(startedAt).toISOString() }
}

/** The holder record of a lock directory, or null when there is none readable. */
export function readHolder(lockDir) {
  try {
    const parsed = JSON.parse(readFileSync(join(lockDir, HOLDER_FILE), 'utf8'))
    if (!parsed || typeof parsed.pid !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

/** Whether a pid is a live process. Signal 0 sends nothing; EPERM means it is alive but not ours. */
export function pidAlive(pid, kill = process.kill) {
  try {
    kill(pid, 0)
    return true
  } catch (e) {
    return e && e.code === 'EPERM'
  }
}

/**
 * Whether a held lock may be taken over: its holder is dead, or it never got a holder.json and is older than the grace.
 * @returns {'live' | 'dead' | 'unwritten'}
 */
export function lockState(lockDir, { isAlive = pidAlive, now = Date.now(), grace = UNWRITTEN_GRACE_MS } = {}) {
  const holder = readHolder(lockDir)
  if (holder) return isAlive(holder.pid) ? 'live' : 'dead'
  try {
    const age = now - statSync(lockDir).mtimeMs
    return age > grace ? 'unwritten' : 'live'
  } catch {
    return 'unwritten'
  }
}

/** Takes a stale lock away: an atomic rename (one winner), then the copy is removed. False when someone else got there first. */
export function takeOverStale(lockDir, { pid = process.pid, now = Date.now() } = {}) {
  const aside = `${lockDir}.stale-${now}-${pid}`
  try {
    renameSync(lockDir, aside)
  } catch {
    return false
  }
  rmSync(aside, { recursive: true, force: true })
  return true
}

/**
 * One attempt at the lock.
 * @returns {{ ok: true } | { ok: false, holder: object | null, state: 'live' | 'dead' | 'unwritten' }}
 */
export function tryAcquire(lockDir, record, deps = {}) {
  mkdirSync(dirname(lockDir), { recursive: true })
  try {
    mkdirSync(lockDir) // never recursive: recursive mkdir answers ok on a directory that already exists
  } catch (e) {
    if (!e || e.code !== 'EEXIST') throw e
    const state = lockState(lockDir, deps)
    const holder = readHolder(lockDir)
    if (state !== 'live') takeOverStale(lockDir, { pid: record.pid, now: deps.now })
    return { ok: false, holder, state }
  }
  writeFileSync(join(lockDir, HOLDER_FILE), JSON.stringify(record) + '\n')
  return { ok: true }
}

/** Removes the lock, but only while holder.json still names this pid. */
export function release(lockDir, pid) {
  const holder = readHolder(lockDir)
  if (!holder || holder.pid !== pid) return false
  rmSync(lockDir, { recursive: true, force: true })
  return true
}

/** The line a waiter prints: who holds the lock, where, since when, and how long this wait has run. */
export function waitWords(holder, waitedMs, { now = Date.now() } = {}) {
  const sofar = Math.round(waitedMs / 1000)
  const wait = sofar < 60 ? `${sofar} s` : `${Math.floor(sofar / 60)} min ${sofar % 60} s`
  if (!holder) return `typecheck: waiting for the lock (holder unknown), ${wait} so far`
  const where = holder.cwd ? ` in ${basename(holder.cwd)}` : ''
  const started = holder.startedAt ? Date.parse(holder.startedAt) : NaN
  const running = Number.isFinite(started) ? `, running ${Math.max(0, Math.round((now - started) / 1000))} s` : ''
  return `typecheck: waiting for the lock held by pid ${holder.pid}${where}${running}; ${wait} so far`
}

/**
 * Waits for the lock, saying who holds it as it waits.
 * @param {string} lockDir
 * @param {object} record from holderRecord
 * @param {{ sleep?: (ms: number) => Promise<void>, now?: () => number, isAlive?: (pid: number) => boolean,
 *           onWait?: (line: string) => void, pollMs?: number, lineEveryMs?: number }} deps
 * @returns {Promise<() => boolean>} the release
 */
export async function acquire(lockDir, record, deps = {}) {
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const now = deps.now ?? Date.now
  const onWait = deps.onWait ?? (() => {})
  const pollMs = deps.pollMs ?? POLL_MS
  const lineEveryMs = deps.lineEveryMs ?? WAIT_LINE_EVERY_MS
  const begin = now()
  let nextLineAt = begin
  for (;;) {
    const attempt = tryAcquire(lockDir, record, { isAlive: deps.isAlive, now: now() })
    if (attempt.ok) return () => release(lockDir, record.pid)
    if (attempt.state !== 'live') continue // the stale lock is gone; try again at once
    const t = now()
    if (t >= nextLineAt) {
      onWait(waitWords(attempt.holder, t - begin, { now: t }))
      nextLineAt = t + lineEveryMs
    }
    await sleep(pollMs)
  }
}
