#!/usr/bin/env node
/**
 * `npm run typecheck`: the full tsc under one machine-wide lock, so two worktrees' typechecks run one after
 * the other instead of holding 9.5 GB each at the same moment (scripts/lib/typecheckLock.mjs has the story).
 *
 *   npm run typecheck                 # waits for the lock, prints who holds it every 30 s, then runs tsc
 *   TYPECHECK_NO_LOCK=1 npm run typecheck   # CI: no lock, each job is its own machine
 *   TYPECHECK_LOCK_DIR=/some/dir npm run typecheck   # the lock somewhere else
 *
 * Extra arguments go to tsc. The exit code is tsc's. The heap is 12 GB since 2026-11-13, when the whole program's check
 * passed 10 GB on GitHub's runners (16 GB of memory); the build's `tsc -b` in package.json has the same heap.
 */
import { execFileSync, spawn } from 'node:child_process'
import { join } from 'node:path'
import { acquire, holderRecord, lockRoot, LOCK_DIR_NAME } from './lib/typecheckLock.mjs'

const TSC_ARGS = ['--max-old-space-size=12288', 'node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']

function gitCommonDir() {
  try {
    return execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch {
    return null
  }
}

function runTsc() {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [...TSC_ARGS, ...process.argv.slice(2)], { stdio: 'inherit' })
    const forward = (signal) => () => {
      child.kill(signal)
    }
    const onInt = forward('SIGINT')
    const onTerm = forward('SIGTERM')
    process.on('SIGINT', onInt)
    process.on('SIGTERM', onTerm)
    child.on('exit', (code, signal) => {
      process.off('SIGINT', onInt)
      process.off('SIGTERM', onTerm)
      resolveRun(signal ? 1 : code ?? 1)
    })
  })
}

async function main() {
  if (process.env.TYPECHECK_NO_LOCK === '1') return runTsc()

  const lockDir = join(lockRoot({ env: process.env, gitCommonDir: gitCommonDir() }), LOCK_DIR_NAME)
  const record = holderRecord({ pid: process.pid, cwd: process.cwd(), startedAt: Date.now() })
  const release = await acquire(lockDir, record, { onWait: (line) => console.error(line) })
  // A signal while tsc runs is forwarded to tsc above; its exit comes back here and the lock is released.
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
