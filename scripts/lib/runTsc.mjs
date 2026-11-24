/**
 * Runs tsc under the heap the machine can give it (scripts/lib/typecheckHeap.mjs), and says so in one line
 * when tsc dies instead of answering. `npm run typecheck` (scripts/typecheck-queued.mjs) and the build's
 * `tsc -b` (scripts/tsc-build.mjs) both go through here, so the two never drift apart on the heap.
 *
 * tsc writes its diagnostics to stdout, which is inherited untouched. stderr is passed through as it comes
 * and watched for V8's heap-death line. A signal sent to the wrapper is forwarded to tsc.
 */
import { spawn } from 'node:child_process'
import { totalmem } from 'node:os'
import { capWords, deathWords, exitCodeFor, heapCapMb, heapDeathWatcher } from './typecheckHeap.mjs'

export const TSC_BIN = 'node_modules/typescript/bin/tsc'

/** Runs `tsc ...tscArgs` and resolves with the exit code. `who` names the caller in the lines printed: `typecheck` or `build`. */
export function runTsc(who, tscArgs) {
  const totalMemBytes = totalmem()
  const capMb = heapCapMb(totalMemBytes, process.env)
  console.error(capWords({ who, capMb, totalMemBytes }))
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [`--max-old-space-size=${capMb}`, TSC_BIN, ...tscArgs], { stdio: ['inherit', 'inherit', 'pipe'] })
    const sawHeapDeath = heapDeathWatcher()
    let heapDeath = false
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      heapDeath = sawHeapDeath(chunk)
    })
    const forward = (signal) => () => {
      child.kill(signal)
    }
    const onInt = forward('SIGINT')
    const onTerm = forward('SIGTERM')
    process.on('SIGINT', onInt)
    process.on('SIGTERM', onTerm)
    child.on('error', (e) => {
      console.error(`${who}: tsc did not start: ${e && e.message ? e.message : String(e)}`)
      resolveRun(1)
    })
    // 'close' and not 'exit': it comes after stderr has ended, so the line below is the last one printed.
    child.on('close', (code, signal) => {
      process.off('SIGINT', onInt)
      process.off('SIGTERM', onTerm)
      const words = deathWords({ who, code, signal, heapDeath, capMb })
      if (words) console.error(words)
      resolveRun(exitCodeFor({ code, signal }))
    })
  })
}
