#!/usr/bin/env node
/**
 * `npm run typecheck`: the full tsc under one machine-wide lock, so two worktrees' typechecks run one after
 * the other instead of holding 9.5 GB each at the same moment (scripts/lib/typecheckLock.mjs has the story).
 *
 *   npm run typecheck                 # waits for the lock, prints who holds it every 30 s, then runs tsc
 *   TYPECHECK_NO_LOCK=1 npm run typecheck   # CI: no lock, each job is its own machine
 *   TYPECHECK_LOCK_DIR=/some/dir npm run typecheck   # the lock somewhere else
 *   TYPECHECK_HEAP_MB=20480 npm run typecheck   # this heap, whatever the machine has
 *
 * Extra arguments go to tsc. The exit code is tsc's, or 128 + n when a signal ended it (134 for a heap death).
 * The heap is sized from the machine's memory since 2026-11-24 (scripts/lib/typecheckHeap.mjs: 85% of it, from
 * 12,288 MB to 16,384 MB), when the whole program's check needed all of the fixed 12 GB it had had since
 * 2026-11-13; the build's `tsc -b` (scripts/tsc-build.mjs) takes the same heap through scripts/lib/runTsc.mjs,
 * which also says in one line when tsc died of its heap and gave no verdict.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { runTsc as runTscUnderHeap } from './lib/runTsc.mjs'
import { acquire, holderRecord, lockRoot, LOCK_DIR_NAME } from './lib/typecheckLock.mjs'

const TSC_ARGS = ['-p', 'tsconfig.json']

function gitCommonDir() {
  try {
    return execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch {
    return null
  }
}

function runTsc() {
  return runTscUnderHeap('typecheck', [...TSC_ARGS, ...process.argv.slice(2)])
}

async function main() {
  if (process.env.TYPECHECK_NO_LOCK === '1') return runTsc()

  const lockDir = join(lockRoot({ env: process.env, gitCommonDir: gitCommonDir() }), LOCK_DIR_NAME)
  const record = holderRecord({ pid: process.pid, cwd: process.cwd(), startedAt: Date.now() })
  const release = await acquire(lockDir, record, { onWait: (line) => console.error(line) })
  // A signal while tsc runs is forwarded to tsc (scripts/lib/runTsc.mjs); its exit comes back here and the lock is released.
  // A kill -9 leaves the directory with a dead pid, and the next waiter takes it over.
  try {
    return await runTsc()
  } finally {
    release()
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e && e.stack ? e.stack : String(e))
    process.exit(1)
  },
)
