import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error — scripts/typecheck-queued.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/typecheckLock.mjs'

/**
 * scripts/lib/typecheckLock.mjs is the machine-wide lock `npm run typecheck` takes so two worktrees' typechecks
 * run one after the other (v2.6736). These pin the acquire, the wait with its 30-second line, the takeover of a
 * lock whose pid is dead, the release that only the holder may do, and where the lock lives.
 */
type Holder = { pid: number; cwd?: string; startedAt?: string }
type Attempt = { ok: true } | { ok: false; holder: Holder | null; state: 'live' | 'dead' | 'unwritten' }
const k = kernel as {
  LOCK_DIR_NAME: string
  HOLDER_FILE: string
  WAIT_LINE_EVERY_MS: number
  POLL_MS: number
  UNWRITTEN_GRACE_MS: number
  lockRoot: (o?: { env?: Record<string, string>; gitCommonDir?: string | null; cwd?: string; tmp?: string }) => string
  holderRecord: (o: { pid: number; cwd: string; startedAt: number }) => Holder
  readHolder: (dir: string) => Holder | null
  pidAlive: (pid: number, kill?: (pid: number, sig: number) => void) => boolean
  lockState: (dir: string, deps?: { isAlive?: (pid: number) => boolean; now?: number; grace?: number }) => string
  takeOverStale: (dir: string, o?: { pid?: number; now?: number }) => boolean
  tryAcquire: (dir: string, record: Holder, deps?: { isAlive?: (pid: number) => boolean; now?: number }) => Attempt
  release: (dir: string, pid: number) => boolean
  waitWords: (holder: Holder | null, waitedMs: number, o?: { now?: number }) => string
  acquire: (
    dir: string,
    record: Holder,
    deps?: {
      sleep?: (ms: number) => Promise<void>
      now?: () => number
      isAlive?: (pid: number) => boolean
      onWait?: (line: string) => void
      pollMs?: number
      lineEveryMs?: number
    },
  ) => Promise<() => boolean>
}

let root: string
let lockDir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'typecheck-lock-'))
  lockDir = join(root, 'locks', k.LOCK_DIR_NAME)
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const alive = () => true
const dead = () => false
const me = (pid = 101) => k.holderRecord({ pid, cwd: '/w/one', startedAt: Date.UTC(2026, 10, 8, 14, 0, 0) })

describe('typecheckLock: acquire and release', () => {
  it('acquires a free lock, writes the holder, and makes the folder it lives in', () => {
    expect(k.tryAcquire(lockDir, me(), { isAlive: alive })).toEqual({ ok: true })
    expect(k.readHolder(lockDir)).toEqual({ pid: 101, cwd: '/w/one', startedAt: '2026-11-08T14:00:00.000Z' })
    expect(JSON.parse(readFileSync(join(lockDir, k.HOLDER_FILE), 'utf8')).pid).toBe(101)
  })

  it('refuses while a live holder has it, naming the holder', () => {
    k.tryAcquire(lockDir, me(101), { isAlive: alive })
    const second = k.tryAcquire(lockDir, me(202), { isAlive: alive })
    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.state).toBe('live')
    expect(second.holder?.pid).toBe(101)
    expect(k.readHolder(lockDir)?.pid).toBe(101)
  })

  it('release removes the lock only for the pid that holds it', () => {
    k.tryAcquire(lockDir, me(101), { isAlive: alive })
    expect(k.release(lockDir, 202)).toBe(false)
    expect(existsSync(lockDir)).toBe(true)
    expect(k.release(lockDir, 101)).toBe(true)
    expect(existsSync(lockDir)).toBe(false)
    expect(k.release(lockDir, 101)).toBe(false) // nothing to release twice
  })
})

describe('typecheckLock: a stale lock', () => {
  it('a dead holder is taken over on the next attempt', () => {
    k.tryAcquire(lockDir, me(101), { isAlive: alive })
    const first = k.tryAcquire(lockDir, me(202), { isAlive: dead })
    expect(first.ok).toBe(false)
    if (first.ok) return
    expect(first.state).toBe('dead')
    expect(first.holder?.pid).toBe(101)
    expect(existsSync(lockDir)).toBe(false) // the stale directory is gone
    expect(k.tryAcquire(lockDir, me(202), { isAlive: dead })).toEqual({ ok: true })
    expect(k.readHolder(lockDir)?.pid).toBe(202)
  })

  it('a directory with no holder.json is live inside the grace and a leftover past it', () => {
    mkdirSync(lockDir, { recursive: true })
    const now = Date.now()
    expect(k.lockState(lockDir, { isAlive: alive, now })).toBe('live')
    const old = new Date(now - k.UNWRITTEN_GRACE_MS - 5000)
    utimesSync(lockDir, old, old)
    expect(k.lockState(lockDir, { isAlive: alive, now })).toBe('unwritten')
    const attempt = k.tryAcquire(lockDir, me(202), { isAlive: alive, now })
    expect(attempt.ok).toBe(false)
    if (attempt.ok) return
    expect(attempt.state).toBe('unwritten')
    expect(existsSync(lockDir)).toBe(false)
  })

  it('an unreadable holder.json reads as no holder', () => {
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(join(lockDir, k.HOLDER_FILE), '{not json')
    expect(k.readHolder(lockDir)).toBeNull()
    writeFileSync(join(lockDir, k.HOLDER_FILE), JSON.stringify({ pid: 'x' }))
    expect(k.readHolder(lockDir)).toBeNull()
  })

  it('takeOverStale has one winner: the second rename finds nothing', () => {
    mkdirSync(lockDir, { recursive: true })
    expect(k.takeOverStale(lockDir, { pid: 1, now: 5 })).toBe(true)
    expect(k.takeOverStale(lockDir, { pid: 2, now: 5 })).toBe(false)
    expect(existsSync(`${lockDir}.stale-5-1`)).toBe(false) // the renamed copy is removed
  })

  it('pidAlive: a live pid, a dead one, and one that is not ours', () => {
    expect(k.pidAlive(process.pid)).toBe(true)
    expect(
      k.pidAlive(1, () => {
        throw Object.assign(new Error('EPERM'), { code: 'EPERM' })
      }),
    ).toBe(true)
    expect(
      k.pidAlive(999999, () => {
        throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' })
      }),
    ).toBe(false)
  })
})

describe('typecheckLock: waiting', () => {
  it('waits, says who holds the lock at once and every 30 seconds, and acquires when the holder lets go', async () => {
    k.tryAcquire(lockDir, me(101), { isAlive: alive })
    let clock = Date.UTC(2026, 10, 8, 14, 1, 0)
    const lines: string[] = []
    let polls = 0
    const sleep = async (ms: number) => {
      clock += ms
      polls += 1
      if (polls === 150) k.release(lockDir, 101) // 75 s in, at 500 ms a poll
    }
    const release = await k.acquire(lockDir, me(202), { sleep, now: () => clock, isAlive: alive, onWait: (l) => lines.push(l) })
    expect(polls).toBe(150)
    expect(lines).toEqual([
      'typecheck: waiting for the lock held by pid 101 in one, running 60 s; 0 s so far',
      'typecheck: waiting for the lock held by pid 101 in one, running 90 s; 30 s so far',
      'typecheck: waiting for the lock held by pid 101 in one, running 120 s; 1 min 0 s so far',
    ])
    expect(k.readHolder(lockDir)?.pid).toBe(202)
    expect(release()).toBe(true)
    expect(existsSync(lockDir)).toBe(false)
  })

  it('a waiter behind a dead holder takes over without sleeping', async () => {
    k.tryAcquire(lockDir, me(101), { isAlive: alive })
    let slept = 0
    const release = await k.acquire(lockDir, me(202), {
      sleep: async () => {
        slept += 1
      },
      isAlive: dead,
    })
    expect(slept).toBe(0)
    expect(k.readHolder(lockDir)?.pid).toBe(202)
    release()
  })

  it('the wait line without a holder record', () => {
    expect(k.waitWords(null, 31_000)).toBe('typecheck: waiting for the lock (holder unknown), 31 s so far')
  })

  it('the defaults are a line every 30 seconds and a poll every half second', () => {
    expect(k.WAIT_LINE_EVERY_MS).toBe(30_000)
    expect(k.POLL_MS).toBe(500)
  })
})

describe('typecheckLock: where the lock lives', () => {
  it('TYPECHECK_LOCK_DIR wins', () => {
    expect(k.lockRoot({ env: { TYPECHECK_LOCK_DIR: '/x/locks' }, gitCommonDir: '/repo/.git' })).toBe('/x/locks')
  })

  it('in a repo: the main checkout’s gitignored .claude/sessions/locks, from the main checkout or a worktree', () => {
    expect(k.lockRoot({ env: {}, gitCommonDir: '/repo/.git' })).toBe('/repo/.claude/sessions/locks')
    expect(k.lockRoot({ env: {}, gitCommonDir: '.git', cwd: '/repo' })).toBe('/repo/.claude/sessions/locks')
    expect(k.lockRoot({ env: {}, gitCommonDir: '/repo/.git/worktrees/w1' })).toBe('/repo/.claude/sessions/locks')
  })

  it('outside a repo: the OS temp folder', () => {
    expect(k.lockRoot({ env: {}, gitCommonDir: null, tmp: '/tmp' })).toBe('/tmp/pipetooling-locks')
  })
})

describe('typecheckLock: the wiring', () => {
  const repo = join(__dirname, '..', '..')
  it('npm run typecheck goes through the wrapper, which keeps the heap and skips the lock for CI', () => {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    expect(pkg.scripts.typecheck).toBe('node scripts/typecheck-queued.mjs')
    const wrapper = readFileSync(join(repo, 'scripts', 'typecheck-queued.mjs'), 'utf8')
    expect(wrapper).toContain("'--max-old-space-size=10240', 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'")
    expect(wrapper).toContain("process.env.TYPECHECK_NO_LOCK === '1'")
  })

  it('every workflow that runs the typecheck sets TYPECHECK_NO_LOCK', () => {
    for (const file of ['ci.yml', 'warm-caches.yml']) {
      const lines = readFileSync(join(repo, '.github', 'workflows', file), 'utf8').split('\n')
      const at = lines.findIndex((l) => /run:\s+npm run typecheck\s*$/.test(l))
      expect(at, `${file} runs npm run typecheck`).toBeGreaterThan(0)
      const step = lines.slice(Math.max(0, at - 6), at + 4).join('\n')
      expect(step, `${file}'s typecheck step skips the lock`).toMatch(/TYPECHECK_NO_LOCK:\s*'1'/)
    }
  })
})
