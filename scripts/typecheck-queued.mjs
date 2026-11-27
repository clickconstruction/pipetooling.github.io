#!/usr/bin/env node
/**
 * `npm run typecheck`: the full type check under one machine-wide lock, so two worktrees' typechecks run one
 * after the other instead of holding 9.5 GB each at the same moment (scripts/lib/typecheckLock.mjs has the story).
 *
 *   npm run typecheck                 # waits for the lock, prints who holds it every 30 s, then runs tsc
 *   TYPECHECK_NO_LOCK=1 npm run typecheck   # CI: no lock, each job is its own machine
 *   TYPECHECK_LOCK_DIR=/some/dir npm run typecheck   # the lock somewhere else
 *   TYPECHECK_HEAP_MB=20480 npm run typecheck   # this heap, whatever the machine has
 *
 * `src` is checked in three parts, one tsc after the other under the one lock (scripts/lib/typecheckParts.mjs,
 * punch list #434): the app without its tests, the tests under src/lib, the tests elsewhere. One program over
 * all of `src` needed 12.3 GB on 2026-11-24, more than a runner would soon have; the largest part needs 8.6.
 * A part that fails does not stop the next, so every part's errors print, and the last line says which parts
 * were clean. Extra arguments go to every tsc. The exit code is the worst part's: tsc's own, or 128 + n when a
 * signal ended a part (134 for a heap death).
 *
 * Each tsc takes its heap from the machine's memory (scripts/lib/typecheckHeap.mjs: 85% of it, from 12,288 MB
 * to 16,384 MB) through scripts/lib/runTsc.mjs, which also says in one line when tsc died of its heap and gave
 * no verdict. The build's `tsc -b` (scripts/tsc-build.mjs) goes through the same runner.
 *
 * Each part ends with one line on its memory (scripts/lib/typecheckMemory.mjs): the time, the heap it held
 * against its cap and the most it held resident, with a warning from four fifths of the cap. The heap is
 * named only when tsc still held its program as it exited, which `tsc -p` here mostly does not, so a part's
 * line is usually the peak alone. The build's `tsc -b` holds it, and CI forces a collection there first.
 */
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { runTsc as runTscUnderHeap } from './lib/runTsc.mjs'
import { acquire, holderRecord, lockRoot, LOCK_DIR_NAME } from './lib/typecheckLock.mjs'
import { outcomeWords, partWords, PARTS, stoppedByHand, worstExit } from './lib/typecheckParts.mjs'

function gitCommonDir() {
  try {
    return execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 }).trim()
  } catch {
    return null
  }
}

/** Every part in order, each its own tsc. A part with errors or a heap death does not stop the next; a Ctrl-C does. */
async function runParts() {
  const results = []
  for (const [index, part] of PARTS.entries()) {
    console.error(partWords({ index, part }))
    const code = await runTscUnderHeap('typecheck', ['-p', part.config, ...process.argv.slice(2)], { label: part.name })
    results.push({ part, code })
    if (stoppedByHand(code)) break
  }
  console.error(outcomeWords(results))
  return worstExit(results.map((r) => r.code))
}

async function main() {
  if (process.env.TYPECHECK_NO_LOCK === '1') return runParts()

  const lockDir = join(lockRoot({ env: process.env, gitCommonDir: gitCommonDir() }), LOCK_DIR_NAME)
  const record = holderRecord({ pid: process.pid, cwd: process.cwd(), startedAt: Date.now() })
  const release = await acquire(lockDir, record, { onWait: (line) => console.error(line) })
  // A signal while tsc runs is forwarded to tsc (scripts/lib/runTsc.mjs); its exit comes back here and the lock is released.
  // A kill -9 leaves the directory with a dead pid, and the next waiter takes it over.
  try {
    return await runParts()
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
