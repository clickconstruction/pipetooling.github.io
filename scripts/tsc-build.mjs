#!/usr/bin/env node
/**
 * The build's `tsc -b`, the first half of `npm run build` and `npm run analyze`, under the heap the machine
 * can give it (scripts/lib/typecheckHeap.mjs) and with the one line that says a heap death was no verdict.
 * It takes no lock: the deploy runs it on a runner of its own. Extra arguments go to tsc. The exit code is
 * tsc's, or 128 + n when a signal ended it.
 */
import { runTsc } from './lib/runTsc.mjs'

runTsc('build', ['-b', ...process.argv.slice(2)]).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e && e.stack ? e.stack : String(e))
    process.exit(1)
  },
)
