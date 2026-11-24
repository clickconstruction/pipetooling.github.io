/**
 * The heap tsc is given, and what the wrapper says when tsc dies instead of answering.
 * Plain JS with no dependencies: scripts/lib/runTsc.mjs runs it on bare Node, and
 * src/lib/typecheckHeap.test.ts pins it.
 *
 * The heap is sized from the machine (v2.8482). On 2026-11-24 the whole program's check needed about
 * 12.1 GB: under the fixed 12,288 MB a cold `tsc -p` died on a GitHub runner at 12,054 MB live, and the
 * deploy's cold `tsc -b` passed with 12,060 MB live. A 16 GB runner has room for more, and a 48 GB Mac
 * for much more, so the cap is a share of what the machine has, never under the old cap and never over
 * a ceiling that keeps two checks at once inside a big Mac. `docs/recent-features/v2.8482.md` has the
 * measurements.
 *
 * A tsc that runs out of heap prints V8's trace and no `error TS` line, so through a pipe that keeps the
 * last lines, or a grep for `error TS`, the run reads as clean. `deathWords` is the one line that says it
 * was no verdict.
 */

/** The cap before v2.8482, and still the least any machine gets. */
export const FLOOR_MB = 12288
/** The most any machine gets: two checks at once (the build's `tsc -b` takes no lock) still fit a 48 GB Mac. */
export const CEILING_MB = 16384
/** The share of the machine's memory the heap may take. A runner's other processes hold about 1.2 GB of its 15.7. */
export const SHARE = 0.85
/** The cap moves in steps of this size. */
export const STEP_MB = 256
/** Set to a number of MB, this is the cap, whatever the machine has. */
export const HEAP_ENV = 'TYPECHECK_HEAP_MB'

const MB = 1024 * 1024

/**
 * The `--max-old-space-size` for tsc, in MB.
 * `totalMemBytes` is `os.totalmem()`; `env` may carry TYPECHECK_HEAP_MB, which wins when it is a positive number.
 */
export function heapCapMb(totalMemBytes, env = {}) {
  const asked = Number(env[HEAP_ENV])
  if (env[HEAP_ENV] !== undefined && env[HEAP_ENV] !== '' && Number.isFinite(asked) && asked > 0) return Math.floor(asked)
  if (!Number.isFinite(totalMemBytes) || totalMemBytes <= 0) return FLOOR_MB
  const share = Math.floor(((totalMemBytes / MB) * SHARE) / STEP_MB) * STEP_MB
  return Math.min(CEILING_MB, Math.max(FLOOR_MB, share))
}

/** The line the wrapper prints before tsc starts, so a log says which heap a run had. */
export function capWords({ who, capMb, totalMemBytes }) {
  return `${who}: tsc has a ${capMb} MB heap on this machine's ${Math.round(totalMemBytes / MB)} MB.`
}

/** What V8 writes to stderr when the heap limit is reached. */
export const HEAP_DEATH_PATTERN = /JavaScript heap out of memory/

/** How much of the end of the stream so far is kept, so a line cut across two chunks is still seen. */
export const CARRY_CHARS = 64

/**
 * Watches a stream's text for V8's heap-death line without keeping the stream.
 * The function it returns takes each chunk in order and answers whether the line has been seen so far.
 */
export function heapDeathWatcher() {
  let carry = ''
  let seen = false
  return (chunk) => {
    if (seen) return true
    const text = carry + String(chunk)
    if (HEAP_DEATH_PATTERN.test(text)) seen = true
    carry = text.slice(-CARRY_CHARS)
    return seen
  }
}

/** Signal numbers for the exit code, the shell's 128 + n. Only the ones a check meets. */
const SIGNAL_NUMBERS = { SIGHUP: 1, SIGINT: 2, SIGQUIT: 3, SIGABRT: 6, SIGKILL: 9, SIGSEGV: 11, SIGTERM: 15 }

/** The wrapper's exit code: tsc's own, or 128 + n when a signal ended it (134 for V8's abort, 137 for a kill). Never 0 for a signal. */
export function exitCodeFor({ code, signal }) {
  if (signal) return SIGNAL_NUMBERS[signal] ? 128 + SIGNAL_NUMBERS[signal] : 1
  return code ?? 1
}

const NOT_CLEAN = 'No "error TS" line above does not mean the code is clean.'

/**
 * One line for a tsc that ended without a verdict, or null when tsc answered (exit 0, or 1 or 2 with its errors).
 * `heapDeath` is the watcher's answer; `code` and `signal` are the child's; `who` is `typecheck` or `build`.
 */
export function deathWords({ who, code, signal, heapDeath, capMb }) {
  const aborted = signal === 'SIGABRT' || code === 134
  const killed = signal === 'SIGKILL' || code === 137
  if (heapDeath || aborted) {
    const why = heapDeath ? `ran out of its ${capMb} MB heap` : `aborted (${signal ?? `exit ${code}`}), most likely out of its ${capMb} MB heap,`
    return `${who}: NO VERDICT. tsc ${why} and stopped before it finished. ${NOT_CLEAN} Run it again, with ${HEAP_ENV} set higher if this machine has the memory.`
  }
  if (killed) {
    return `${who}: NO VERDICT. tsc was killed (${signal ?? `exit ${code}`}) before it finished, which is how a machine that is out of memory stops it. ${NOT_CLEAN}`
  }
  if (signal) return `${who}: NO VERDICT. tsc was stopped by ${signal} before it finished. ${NOT_CLEAN}`
  return null
}
