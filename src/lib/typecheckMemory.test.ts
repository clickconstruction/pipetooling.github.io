import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — scripts/lib/runTsc.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/typecheckMemory.mjs'

/**
 * scripts/lib/typecheckMemory.mjs writes the one line every tsc ends with: its time, the heap it held against
 * its cap, the most it held resident, and a warning from four fifths of the cap (punch list #434, PR 2).
 * These pin when a run collects, how the hook's line leaves the stream, the two units a peak comes in, the
 * words at the sizes measured on 2026-11-24, the warning and its GitHub annotation, the hook itself run in a
 * real Node, and the runner's wiring.
 */
type Report = { heapUsedMb: number; residentPeakMb: number; collected: boolean; collectMs: number }
type Splitter = { push: (chunk: string | Uint8Array) => string; end: () => string; raw: () => string | null }
type Words = { who: string; label?: string; report: Report; capMb: number }
const k = kernel as {
  MEMORY_MARK: string
  HOOK_FILE: string
  NEAR_CAP_SHARE: number
  HEAP_REAL_SHARE: number
  COLLECT_ENV: string
  CARD: string
  collects: (env?: Record<string, string | undefined>) => boolean
  hookNodeArgs: (o: { hookPath: string; collect: boolean }) => string[]
  memoryLineSplitter: () => Splitter
  readMemoryReport: (raw: unknown) => Report | null
  heapIsReal: (report: Report) => boolean
  heldMb: (report: Report) => number
  nearCap: (report: Report, capMb: number) => boolean
  wallWords: (ms: number) => string
  memoryWords: (o: Words & { wallMs: number }) => string
  nearCapWords: (o: Words) => string | null
  nearCapAnnotation: (o: { words: string | null; label?: string; env?: Record<string, string | undefined> }) => string | null
}

const MB = 1024 * 1024
const repo = join(__dirname, '..', '..')
const read = (...parts: string[]) => readFileSync(join(repo, ...parts), 'utf8')
const hookPath = join(repo, 'scripts', 'lib', k.HOOK_FILE)

/** A runner's cap (v2.8482) and the largest part's cold numbers on 2026-11-24. */
const RUNNER_CAP = 13312
const largestPart: Report = { heapUsedMb: 8578, residentPeakMb: 9085, collected: true, collectMs: 6100 }

describe('typecheckMemory: when a run collects first', () => {
  it('CI forces the collection, a dev machine does not, and the switch wins either way', () => {
    expect(k.collects({ CI: 'true' })).toBe(true)
    expect(k.collects({ CI: '1' })).toBe(true)
    expect(k.collects({})).toBe(false)
    expect(k.collects({ CI: 'false' })).toBe(false)
    expect(k.collects({ CI: '' })).toBe(false)
    expect(k.collects({ [k.COLLECT_ENV]: '1' })).toBe(true)
    expect(k.collects({ CI: 'true', [k.COLLECT_ENV]: '0' })).toBe(false)
  })

  it('tsc always gets the hook, and --expose-gc only when the run collects', () => {
    expect(k.hookNodeArgs({ hookPath: '/repo/scripts/lib/hook.cjs', collect: false })).toEqual(['--require', '/repo/scripts/lib/hook.cjs'])
    expect(k.hookNodeArgs({ hookPath: '/repo/scripts/lib/hook.cjs', collect: true })).toEqual(['--require', '/repo/scripts/lib/hook.cjs', '--expose-gc'])
  })
})

describe("typecheckMemory: the hook's line leaves the stream", () => {
  const line = `${k.MEMORY_MARK}{"heapUsedBytes":1}\n`

  it('passes every other line through whole and keeps the report', () => {
    const s = k.memoryLineSplitter()
    expect(s.push('first line\nsecond ')).toBe('first line\n')
    expect(s.push('line\n')).toBe('second line\n')
    expect(s.push(line)).toBe('')
    expect(s.end()).toBe('')
    expect(s.raw()).toBe('{"heapUsedBytes":1}')
  })

  it('finds the line when it is cut across chunks, even inside the mark', () => {
    for (let cut = 1; cut < line.length; cut += 1) {
      const s = k.memoryLineSplitter()
      const passed = s.push(`before\n${line.slice(0, cut)}`) + s.push(line.slice(cut)) + s.end()
      expect(passed, `cut at ${cut}`).toBe('before\n')
      expect(s.raw(), `cut at ${cut}`).toBe('{"heapUsedBytes":1}')
    }
  })

  it('keeps what a half-written line held before the mark, and a last line with no line break', () => {
    const s = k.memoryLineSplitter()
    expect(s.push(`half a line${line}`)).toBe('half a line\n')
    expect(s.raw()).toBe('{"heapUsedBytes":1}')
    const t = k.memoryLineSplitter()
    expect(t.push('no line break at the end')).toBe('')
    expect(t.end()).toBe('no line break at the end')
    expect(t.end()).toBe('')
    expect(t.raw()).toBeNull()
  })

  it("V8's heap-death trace passes through untouched and leaves no report", () => {
    const trace = '\n<--- Last few GCs --->\n\nFATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n 1: 0xb7c2e0 node::Abort()\n'
    const s = k.memoryLineSplitter()
    expect(s.push(trace) + s.end()).toBe(trace)
    expect(s.raw()).toBeNull()
  })
})

describe('typecheckMemory: reading the numbers', () => {
  it('a peak in kilobytes, as Linux and a current Node give it', () => {
    const raw = JSON.stringify({ heapUsedBytes: 8578 * MB, rssBytes: 9000 * MB, maxRss: 9085 * 1024, collected: true, collectMs: 6100 })
    expect(k.readMemoryReport(raw)).toEqual(largestPart)
  })

  it('a peak in bytes, as a Mac with an older libuv gives it, large or small', () => {
    const big = JSON.stringify({ heapUsedBytes: 8000 * MB, rssBytes: 8300 * MB, maxRss: 8556 * MB, collected: false, collectMs: 0 })
    expect(k.readMemoryReport(big)).toEqual({ heapUsedMb: 8000, residentPeakMb: 8556, collected: false, collectMs: 0 })
    // 30 MB in bytes is under a 48 GB machine's memory in kilobytes, so the machine's size could not tell the unit.
    const small = JSON.stringify({ heapUsedBytes: 4 * MB, rssBytes: 29 * MB, maxRss: 30 * MB, collected: false, collectMs: 0 })
    expect(k.readMemoryReport(small)?.residentPeakMb).toBe(30)
  })

  it('a process that holds far less as it exits than it did at its most still reads its peak in kilobytes', () => {
    const raw = JSON.stringify({ heapUsedBytes: 300 * MB, rssBytes: 2000 * MB, maxRss: 8813 * 1024, collected: true, collectMs: 400 })
    expect(k.readMemoryReport(raw)).toEqual({ heapUsedMb: 300, residentPeakMb: 8813, collected: true, collectMs: 400 })
  })

  it('answers null for anything that is not the report', () => {
    expect(k.readMemoryReport('not json')).toBeNull()
    expect(k.readMemoryReport('null')).toBeNull()
    expect(k.readMemoryReport('{}')).toBeNull()
    expect(k.readMemoryReport(JSON.stringify({ heapUsedBytes: 0, rssBytes: 1, maxRss: 1 }))).toBeNull()
  })
})

describe('typecheckMemory: the words', () => {
  it('the time reads as minutes and seconds', () => {
    expect(k.wallWords(0)).toBe('0:00')
    expect(k.wallWords(17_400)).toBe('0:17')
    expect(k.wallWords(397_000)).toBe('6:37')
    expect(k.wallWords(3_725_000)).toBe('1:02:05')
  })

  /** The deploy's `tsc -b` of the app part, cold, on 2026-11-27: it still held its program as it exited. */
  const deployBuild: Report = { heapUsedMb: 7995, residentPeakMb: 9357, collected: true, collectMs: 4900 }
  /** A cold `tsc -p` of the same part the same day, on a runner with a 13,568 MB cap: it had let its program go. */
  const coldPart: Report = { heapUsedMb: 33, residentPeakMb: 8857, collected: true, collectMs: 100 }

  it('the heap is the program\'s only when a collection ran and tsc still held its program', () => {
    expect(k.HEAP_REAL_SHARE).toBe(0.25)
    expect(k.heapIsReal(deployBuild)).toBe(true)
    expect(k.heapIsReal(coldPart)).toBe(false)
    // A warm part with this change's tests to check still held it: 3,492 MB of a 3,877 MB peak.
    expect(k.heapIsReal({ heapUsedMb: 3492, residentPeakMb: 3877, collected: true, collectMs: 1300 })).toBe(true)
    // A warm part that found nothing changed had let it go: 28 MB of a 3,520 MB peak.
    expect(k.heapIsReal({ heapUsedMb: 28, residentPeakMb: 3520, collected: true, collectMs: 0 })).toBe(false)
    // Not collected, the heap in use is partly what was not yet thrown away, whatever its size.
    expect(k.heapIsReal({ ...deployBuild, collected: false })).toBe(false)
  })

  it('a run that still held its program says what the program needs, against its cap', () => {
    expect(k.memoryWords({ who: 'build', label: 'app', report: deployBuild, capMb: RUNNER_CAP, wallMs: 349_000 })).toBe(
      "build: app's tsc took 5:49, ended holding 7,995 MB of its 13,312 MB heap (60%) after a collection of 4.9 s, and held 9,357 MB resident at most.",
    )
  })

  it('a run that had let its program go says its peak alone, and never the 33 MB', () => {
    const words = k.memoryWords({ who: 'typecheck', label: 'app', report: coldPart, capMb: 13568, wallMs: 335_000 })
    expect(words).toBe("typecheck: app's tsc took 5:35 and held 8,857 MB resident at most, 65% of its 13,568 MB heap.")
    expect(words).not.toMatch(/33 MB|collection|ended/)
  })

  it('a run that did not collect says its peak alone too, and a run with no label is plain tsc', () => {
    const warm: Report = { heapUsedMb: 3300, residentPeakMb: 3988, collected: false, collectMs: 0 }
    expect(k.memoryWords({ who: 'build', report: warm, capMb: 16384, wallMs: 41_000 })).toBe(
      'build: tsc took 0:41 and held 3,988 MB resident at most, 24% of its 16,384 MB heap.',
    )
  })
})

describe('typecheckMemory: the warning', () => {
  const at = (heapUsedMb: number, residentPeakMb: number): Report => ({ heapUsedMb, residentPeakMb, collected: true, collectMs: 0 })

  it('reads the larger of the heap in use and the peak resident size', () => {
    expect(k.heldMb(at(8578, 9085))).toBe(9085)
    expect(k.heldMb(at(300, 8813))).toBe(8813)
    // A Mac that compresses memory can show less resident than the heap holds.
    expect(k.heldMb(at(9000, 7000))).toBe(9000)
  })

  it('starts at four fifths of the cap, which is three weeks of room on a runner at 130 MB a day', () => {
    expect(k.NEAR_CAP_SHARE).toBe(0.8)
    const roomMb = RUNNER_CAP * (1 - k.NEAR_CAP_SHARE)
    expect(roomMb / 130).toBeGreaterThan(20)
    expect(k.nearCap(largestPart, RUNNER_CAP)).toBe(false)
    expect(k.nearCap(at(10000, 10649), RUNNER_CAP)).toBe(false)
    expect(k.nearCap(at(10000, 10650), RUNNER_CAP)).toBe(true)
    expect(k.nearCap(at(10650, 9000), RUNNER_CAP)).toBe(true)
    expect(k.nearCap(largestPart, 0)).toBe(false)
  })

  it('says nothing under it, and above it names the room left and the card', () => {
    expect(k.nearCapWords({ who: 'typecheck', label: 'tests-rest', report: largestPart, capMb: RUNNER_CAP })).toBeNull()
    const words = k.nearCapWords({ who: 'typecheck', label: 'tests-rest', report: at(10400, 10900), capMb: RUNNER_CAP })
    expect(words).toBe(
      "typecheck: NEAR ITS HEAP. tests-rest's tsc held 10,900 MB against a 13,312 MB heap (82%), which leaves 2,412 MB. " +
        "This is a warning and the check's answer stands. The program grows with the code and tsc dies at the cap with no verdict, so cut the program before then: " +
        'punch list #434, to-dos/type-check-in-parts.md.',
    )
    expect(words).toContain(k.CARD)
    expect(read('to-dos', 'type-check-in-parts.md')).toContain('number: 434')
  })

  it('is an annotation on GitHub Actions alone, with the percent sign escaped', () => {
    const words = k.nearCapWords({ who: 'build', label: 'app', report: at(300, 11000), capMb: RUNNER_CAP })
    expect(k.nearCapAnnotation({ words, label: 'app', env: {} })).toBeNull()
    expect(k.nearCapAnnotation({ words: null, label: 'app', env: { GITHUB_ACTIONS: 'true' } })).toBeNull()
    const annotation = k.nearCapAnnotation({ words, label: 'app', env: { GITHUB_ACTIONS: 'true' } })
    expect(annotation).toMatch(/^::warning title=The type check is near its heap \(app\)::build: NEAR ITS HEAP\. /)
    expect(annotation).toContain('(83%25)')
    expect(annotation).not.toMatch(/\d%[^2]/)
    expect(annotation?.split('\n')).toHaveLength(1)
  })
})

describe('typecheckMemory: the hook, run in a real Node', () => {
  /** Runs a one-line program with the hook preloaded and answers what the runner would read. */
  function runHooked(extraNodeArgs: string[], program: string) {
    const out = spawnSync(process.execPath, [...extraNodeArgs, '--require', hookPath, '-e', program], { encoding: 'utf8' })
    const s = k.memoryLineSplitter()
    const passed = s.push(out.stderr) + s.end()
    return { status: out.status, passed, raw: s.raw(), report: s.raw() === null ? null : k.readMemoryReport(s.raw()) }
  }

  it("writes one report as the process exits and leaves the exit code and the rest of stderr alone", () => {
    const run = runHooked([], "console.error('an error line'); process.exit(2)")
    expect(run.status).toBe(2)
    expect(run.passed).toBe('an error line\n')
    expect(run.report).not.toBeNull()
    expect(run.report?.collected).toBe(false)
    expect(run.report?.heapUsedMb).toBeGreaterThan(0)
    // A bare Node holds tens of MB, whichever unit this machine's Node gives its peak in.
    expect(run.report?.residentPeakMb).toBeGreaterThan(10)
    expect(run.report?.residentPeakMb).toBeLessThan(1024)
  })

  it('collects first when Node was given --expose-gc, and says that it did', () => {
    // No size is compared here: what a run that did not collect still holds is V8's own timing.
    const collected = runHooked(['--expose-gc'], 'process.exitCode = 0')
    expect(collected.status).toBe(0)
    expect(collected.passed).toBe('')
    expect(collected.report?.collected).toBe(true)
    expect(collected.report?.collectMs).toBeGreaterThanOrEqual(0)
    expect(collected.report?.heapUsedMb).toBeGreaterThan(0)
  })

  it('holds the same mark as the kernel, and loads by --require: --import stops tsc from starting on Node 20.0', () => {
    expect(read('scripts', 'lib', k.HOOK_FILE)).toContain(`const MARK = '${k.MEMORY_MARK}'`)
    expect(k.HOOK_FILE).toMatch(/\.cjs$/)
    expect(k.hookNodeArgs({ hookPath, collect: true })).not.toContain('--import')
  })
})

describe('typecheckMemory: the wiring', () => {
  it('the runner preloads the hook, takes its line out of stderr and prints the words after the death line', () => {
    const runner = read('scripts', 'lib', 'runTsc.mjs')
    expect(runner).toContain('const HOOK_PATH = fileURLToPath(new URL(`./${HOOK_FILE}`, import.meta.url))')
    expect(runner).toContain('hookNodeArgs({ hookPath: HOOK_PATH, collect: collects(process.env) })')
    expect(runner).toContain('const pass = memoryLine.push(chunk)')
    expect(runner).toContain('memoryWords({ who, label, report, capMb, wallMs: Date.now() - startedAt })')
    expect(runner.indexOf('deathWords({ who, code, signal, heapDeath, capMb })')).toBeLessThan(runner.indexOf('memoryWords({ who, label'))
    // The warning never changes the answer: the exit code is tsc's own.
    expect(runner).toContain('resolveRun(exitCodeFor({ code, signal }))')
    expect(runner).not.toMatch(/near[^\n]*resolveRun\(1\)/)
  })

  it('each caller names its run, so the line says which part it was', () => {
    expect(read('scripts', 'typecheck-queued.mjs')).toContain('{ label: part.name }')
    expect(read('scripts', 'tsc-build.mjs')).toContain('{ label: BUILD_PART.name }')
  })
})
