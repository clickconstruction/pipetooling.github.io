import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — scripts/lib/runTsc.mjs runs the kernel on bare Node, so it is plain JS with no types
import * as kernel from '../../scripts/lib/typecheckHeap.mjs'

/**
 * scripts/lib/typecheckHeap.mjs sizes tsc's heap from the machine and writes the one line a heap death gets
 * (v2.8482). These pin the rule at the machines measured on 2026-11-24, the override, the watcher over V8's
 * own words, the exit code, and that the typecheck and the build both go through the one runner.
 */
type Death = { who: string; code: number | null; signal: string | null; heapDeath: boolean; capMb: number }
const k = kernel as {
  FLOOR_MB: number
  CEILING_MB: number
  SHARE: number
  STEP_MB: number
  HEAP_ENV: string
  CARRY_CHARS: number
  HEAP_DEATH_PATTERN: RegExp
  heapCapMb: (totalMemBytes: number, env?: Record<string, string | undefined>) => number
  capWords: (o: { who: string; capMb: number; totalMemBytes: number }) => string
  heapDeathWatcher: () => (chunk: string | Uint8Array) => boolean
  exitCodeFor: (o: { code: number | null; signal: string | null }) => number
  deathWords: (o: Death) => string | null
}

const KB = 1024
const GB = 1024 * 1024 * 1024

describe('typecheckHeap: the cap from the machine', () => {
  it("a GitHub runner gets more than the old 12,288 MB and stays inside what it has", () => {
    // /proc/meminfo's MemTotal on the two runner sizes met on 2026-11-24.
    expect(k.heapCapMb(16077548 * KB)).toBe(13312)
    expect(k.heapCapMb(16366632 * KB)).toBe(13568)
    // The process holds about 265 MB over its cap when the heap is full, and the runner's other processes about 1,250 MB.
    for (const totalKb of [16077548, 16366632]) {
      const totalMb = totalKb / KB
      expect(k.heapCapMb(totalKb * KB) + 265 + 1250).toBeLessThan(totalMb)
    }
  })

  it('a big Mac gets the ceiling, so two checks at once still fit it', () => {
    expect(k.heapCapMb(48 * GB)).toBe(16384)
    expect(k.heapCapMb(32 * GB)).toBe(16384)
    expect(k.heapCapMb(24 * GB)).toBe(16384)
    expect(2 * k.CEILING_MB).toBeLessThan(48 * 1024)
  })

  it('a 16 GB or 18 GB machine gets its share in 256 MB steps', () => {
    expect(k.heapCapMb(16 * GB)).toBe(13824)
    expect(k.heapCapMb(18 * GB)).toBe(15616)
    expect(k.heapCapMb(16 * GB) % k.STEP_MB).toBe(0)
  })

  it('a small machine, or one that will not say, keeps the old cap', () => {
    expect(k.FLOOR_MB).toBe(12288)
    expect(k.heapCapMb(8 * GB)).toBe(12288)
    expect(k.heapCapMb(14 * GB)).toBe(12288)
    expect(k.heapCapMb(0)).toBe(12288)
    expect(k.heapCapMb(Number.NaN)).toBe(12288)
  })

  it('never falls as memory rises', () => {
    let last = 0
    for (let gb = 4; gb <= 128; gb += 0.5) {
      const cap = k.heapCapMb(gb * GB)
      expect(cap).toBeGreaterThanOrEqual(last)
      expect(cap).toBeGreaterThanOrEqual(k.FLOOR_MB)
      expect(cap).toBeLessThanOrEqual(k.CEILING_MB)
      last = cap
    }
  })

  it('TYPECHECK_HEAP_MB wins when it is a positive number, under the floor and over the ceiling too', () => {
    expect(k.HEAP_ENV).toBe('TYPECHECK_HEAP_MB')
    expect(k.heapCapMb(48 * GB, { TYPECHECK_HEAP_MB: '20480' })).toBe(20480)
    expect(k.heapCapMb(48 * GB, { TYPECHECK_HEAP_MB: '64' })).toBe(64)
    expect(k.heapCapMb(48 * GB, { TYPECHECK_HEAP_MB: '9000.7' })).toBe(9000)
    for (const bad of ['', '0', '-5', 'lots', 'NaN']) expect(k.heapCapMb(48 * GB, { TYPECHECK_HEAP_MB: bad })).toBe(16384)
    expect(k.heapCapMb(48 * GB, {})).toBe(16384)
  })

  it('says which heap a run had', () => {
    expect(k.capWords({ who: 'typecheck', capMb: 13312, totalMemBytes: 16077548 * KB })).toBe("typecheck: tsc has a 13312 MB heap on this machine's 15701 MB.")
  })
})

describe('typecheckHeap: a death is no verdict', () => {
  // The two lines V8 wrote on the runners, 2026-11-24.
  const REACHED = 'FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory\n'
  const INEFFECTIVE = 'FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory\n'

  it("the watcher sees both of V8's lines, whole or cut across chunks, and nothing in a clean stream", () => {
    for (const line of [REACHED, INEFFECTIVE]) {
      const whole = k.heapDeathWatcher()
      expect(whole('<--- Last few GCs --->\n')).toBe(false)
      expect(whole(line)).toBe(true)
      expect(whole(' 1: 0xb7a940 node::Abort()\n')).toBe(true)
      for (let cut = 1; cut < line.length; cut++) {
        const parts = k.heapDeathWatcher()
        parts(line.slice(0, cut))
        expect(parts(line.slice(cut)), `cut at ${cut}`).toBe(true)
      }
    }
    const clean = k.heapDeathWatcher()
    expect(clean('typecheck: waiting for the lock held by pid 1 in one, running 30 s; 30 s so far\n')).toBe(false)
    expect(clean(new TextEncoder().encode('a heap of words about memory'))).toBe(false)
    expect('JavaScript heap out of memory'.length).toBeLessThanOrEqual(k.CARRY_CHARS)
  })

  it('a heap death names the heap, says it is no verdict, and offers the bigger heap', () => {
    const words = k.deathWords({ who: 'typecheck', code: null, signal: 'SIGABRT', heapDeath: true, capMb: 12288 })
    expect(words).toBe(
      'typecheck: NO VERDICT. tsc ran out of its 12288 MB heap and stopped before it finished. No "error TS" line above does not mean the code is clean. Run it again, with TYPECHECK_HEAP_MB set higher if this machine has the memory.',
    )
    // A grep for tsc's errors over the whole output finds the line, so the run no longer reads as clean there either.
    expect(words).toContain('error TS')
    expect(words?.split('\n')).toHaveLength(1)
  })

  it('an abort with no line from V8, by signal or as exit 134, still says the heap is the likely reason', () => {
    expect(k.deathWords({ who: 'build', code: null, signal: 'SIGABRT', heapDeath: false, capMb: 13312 })).toContain(
      'build: NO VERDICT. tsc aborted (SIGABRT), most likely out of its 13312 MB heap, and stopped before it finished.',
    )
    expect(k.deathWords({ who: 'build', code: 134, signal: null, heapDeath: false, capMb: 13312 })).toContain('tsc aborted (exit 134), most likely out of its 13312 MB heap,')
  })

  it('a kill names the machine out of memory, and any other signal is named', () => {
    expect(k.deathWords({ who: 'typecheck', code: null, signal: 'SIGKILL', heapDeath: false, capMb: 13312 })).toBe(
      'typecheck: NO VERDICT. tsc was killed (SIGKILL) before it finished, which is how a machine that is out of memory stops it. No "error TS" line above does not mean the code is clean.',
    )
    expect(k.deathWords({ who: 'typecheck', code: 137, signal: null, heapDeath: false, capMb: 13312 })).toContain('tsc was killed (exit 137)')
    expect(k.deathWords({ who: 'typecheck', code: null, signal: 'SIGTERM', heapDeath: false, capMb: 13312 })).toBe(
      'typecheck: NO VERDICT. tsc was stopped by SIGTERM before it finished. No "error TS" line above does not mean the code is clean.',
    )
  })

  it('says nothing when tsc answered: clean, or with its errors', () => {
    for (const code of [0, 1, 2]) expect(k.deathWords({ who: 'typecheck', code, signal: null, heapDeath: false, capMb: 13312 })).toBeNull()
  })

  it("the exit code is tsc's own, and 128 + n for a signal, never 0", () => {
    expect(k.exitCodeFor({ code: 0, signal: null })).toBe(0)
    expect(k.exitCodeFor({ code: 2, signal: null })).toBe(2)
    expect(k.exitCodeFor({ code: null, signal: null })).toBe(1)
    expect(k.exitCodeFor({ code: null, signal: 'SIGABRT' })).toBe(134)
    expect(k.exitCodeFor({ code: null, signal: 'SIGKILL' })).toBe(137)
    expect(k.exitCodeFor({ code: null, signal: 'SIGINT' })).toBe(130)
    expect(k.exitCodeFor({ code: null, signal: 'SIGUSR2' })).toBe(1)
  })
})

describe('typecheckHeap: the wiring', () => {
  const repo = join(__dirname, '..', '..')
  const read = (...parts: string[]) => readFileSync(join(repo, ...parts), 'utf8')

  it('the build and the typecheck both run tsc through the one runner, and nothing else names a heap for tsc', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts.build).toMatch(/^node scripts\/tsc-build\.mjs && /)
    expect(pkg.scripts.analyze).toMatch(/^node scripts\/tsc-build\.mjs && /)
    for (const [name, script] of Object.entries(pkg.scripts)) {
      expect(script, `package.json's ${name} runs tsc -b or tsc -p tsconfig.json by its own heap`).not.toMatch(/max-old-space-size=\d+ node_modules\/typescript\/bin\/tsc (-b|-p tsconfig\.json)/)
    }
    expect(read('scripts', 'tsc-build.mjs')).toContain("runTsc('build', ['-b', BUILD_PART.config, ...process.argv.slice(2)])")
    expect(read('scripts', 'typecheck-queued.mjs')).toContain("runTscUnderHeap('typecheck', ['-p', part.config, ...process.argv.slice(2)])")
  })

  it('the runner sizes the heap from the machine, watches stderr and prints the death line last', () => {
    const runner = read('scripts', 'lib', 'runTsc.mjs')
    expect(runner).toContain('heapCapMb(totalMemBytes, process.env)')
    expect(runner).toContain('`--max-old-space-size=${capMb}`, TSC_BIN, ...tscArgs')
    expect(runner).toContain("stdio: ['inherit', 'inherit', 'pipe']")
    expect(runner).toContain("child.on('close'")
    expect(runner).toContain('deathWords({ who, code, signal, heapDeath, capMb })')
  })
})
