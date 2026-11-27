/**
 * Runs tsc under the heap the machine can give it (scripts/lib/typecheckHeap.mjs), and says so in one line
 * when tsc dies instead of answering. `npm run typecheck` (scripts/typecheck-queued.mjs) and the build's
 * `tsc -b` (scripts/tsc-build.mjs) both go through here, so the two never drift apart on the heap.
 *
 * tsc writes its diagnostics to stdout, which is inherited untouched. stderr is passed through a line at a
 * time and watched for V8's heap-death line. A signal sent to the wrapper is forwarded to tsc.
 *
 * Every tsc that answers ends with one line on its memory (scripts/lib/typecheckMemory.mjs, punch list #434):
 * how long it took, the heap it held against its cap, the most it held resident. A hook preloaded into tsc
 * writes the numbers to stderr as it exits, and that line is taken out of the stream here. A run that held
 * four fifths of its cap gets a warning after it, and on GitHub Actions an annotation; its exit code is tsc's.
 */
import { spawn } from 'node:child_process'
import { totalmem } from 'node:os'
import { fileURLToPath } from 'node:url'
import { capWords, deathWords, exitCodeFor, heapCapMb, heapDeathWatcher } from './typecheckHeap.mjs'
import { collects, HOOK_FILE, hookNodeArgs, memoryLineSplitter, memoryWords, nearCapAnnotation, nearCapWords, readMemoryReport } from './typecheckMemory.mjs'

export const TSC_BIN = 'node_modules/typescript/bin/tsc'

/** The hook preloaded into tsc, by its full path: tsc runs from the repo root and the hook lives beside this file. */
const HOOK_PATH = fileURLToPath(new URL(`./${HOOK_FILE}`, import.meta.url))

/**
 * Runs `tsc ...tscArgs` and resolves with the exit code. `who` names the caller in the lines printed:
 * `typecheck` or `build`. `label` names the run in its memory line, a part's name.
 */
export function runTsc(who, tscArgs, { label } = {}) {
  const totalMemBytes = totalmem()
  const capMb = heapCapMb(totalMemBytes, process.env)
  console.error(capWords({ who, capMb, totalMemBytes }))
  const startedAt = Date.now()
  return new Promise((resolveRun) => {
    const nodeArgs = [`--max-old-space-size=${capMb}`, ...hookNodeArgs({ hookPath: HOOK_PATH, collect: collects(process.env) })]
    const child = spawn(process.execPath, [...nodeArgs, TSC_BIN, ...tscArgs], { stdio: ['inherit', 'inherit', 'pipe'] })
    const sawHeapDeath = heapDeathWatcher()
    const memoryLine = memoryLineSplitter()
    let heapDeath = false
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      heapDeath = sawHeapDeath(chunk)
      const pass = memoryLine.push(chunk)
      if (pass) process.stderr.write(pass)
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
      const rest = memoryLine.end()
      if (rest) process.stderr.write(`${rest}\n`)
      const words = deathWords({ who, code, signal, heapDeath, capMb })
      if (words) console.error(words)
      const raw = memoryLine.raw()
      const report = raw === null ? null : readMemoryReport(raw)
      if (report) {
        console.error(memoryWords({ who, label, report, capMb, wallMs: Date.now() - startedAt }))
        const near = nearCapWords({ who, label, report, capMb })
        if (near) console.error(near)
        // A workflow command is read from the step's output; stdout is the stream GitHub documents for it.
        const annotation = nearCapAnnotation({ words: near, label, env: process.env })
        if (annotation) console.log(annotation)
      }
      resolveRun(exitCodeFor({ code, signal }))
    })
  })
}
