#!/usr/bin/env node
/**
 * The build's `tsc -b`, the first half of `npm run build` and `npm run analyze`, under the heap the machine
 * can give it (scripts/lib/typecheckHeap.mjs) and with the one line that says a heap death was no verdict.
 * It checks the app part alone (scripts/lib/typecheckParts.mjs): the tests do not ship, and the merge queue's
 * `checks` job has checked them on the same content. It takes no lock: the deploy runs it on a runner of its
 * own. Extra arguments go to tsc. The exit code is tsc's, or 128 + n when a signal ended it.
 */
import { runTsc } from './lib/runTsc.mjs'
import { BUILD_PART } from './lib/typecheckParts.mjs'

runTsc('build', ['-b', BUILD_PART.config, ...process.argv.slice(2)], { label: BUILD_PART.name }).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e && e.stack ? e.stack : String(e))
    process.exit(1)
  },
)
