'use strict'
/**
 * Preloaded into tsc by scripts/lib/runTsc.mjs (`node --require <this file> tsc ...`), so every type check
 * says what memory it held (punch list #434, PR 2). When tsc exits it writes one line to stderr, the mark
 * and a JSON object, which the runner takes out of the stream and turns into words
 * (scripts/lib/typecheckMemory.mjs, which holds the same mark and src/lib/typecheckMemory.test.ts holds
 * the two equal).
 *
 * CommonJS and `--require`, not a module and `--import`: on Node 20.0 `--import` sends tsc's own entry file,
 * which has no extension, through the module loader, and tsc never starts. It runs inside `process.exit`,
 * so tsc's program is still reachable: with `--expose-gc` (the runner passes it on CI) one collection is
 * forced first and the heap in use is what the program needs, not what it had not yet thrown away. That
 * holds for a run that checked something, `tsc -p` or the build's `tsc -b`. A warm run that found nothing
 * changed has let its program go by now and reads about 28 MB, so the peak resident size is its number.
 *
 * A heap death never reaches here: V8 aborts, the runner prints NO VERDICT and no memory line.
 * Nothing in here may change tsc's exit, so every failure is swallowed.
 */
const { writeSync } = require('node:fs')
const { getHeapStatistics } = require('node:v8')

const MARK = 'tsc-memory-report:'

process.on('exit', () => {
  try {
    const collected = typeof globalThis.gc === 'function'
    const started = Date.now()
    if (collected) globalThis.gc()
    const collectMs = collected ? Date.now() - started : 0
    const heap = getHeapStatistics()
    // rssBytes is always bytes. maxRss is kilobytes by Node's docs and bytes on a Mac with an older libuv,
    // so the runner needs the first to read the second.
    const report = {
      heapUsedBytes: heap.used_heap_size,
      rssBytes: process.memoryUsage.rss(),
      maxRss: process.resourceUsage().maxRSS,
      collected,
      collectMs,
    }
    writeSync(2, `${MARK}${JSON.stringify(report)}\n`)
  } catch {
    // No report is better than a changed exit code.
  }
})
