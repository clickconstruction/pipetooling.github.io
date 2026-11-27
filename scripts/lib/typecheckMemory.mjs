/**
 * What a type check says about its memory, and when it warns (punch list #434, PR 2).
 * Plain JS with no dependencies: scripts/lib/runTsc.mjs runs it on bare Node, and
 * src/lib/typecheckMemory.test.ts pins it.
 *
 * The heap tsc needs grows with the code, about 130 MB a day for the largest part on 2026-11-24, and tsc
 * dies at its cap with no warning. So every run of tsc ends with one line: how long it took, the heap it
 * held at the end against its cap, and the most it held resident. The numbers come from a hook preloaded
 * into tsc (scripts/lib/tscMemoryHook.cjs), which writes one marked line to stderr as tsc exits; the runner
 * takes that line out of the stream and prints these words in its place.
 *
 * Two numbers, because neither is right alone. The heap in use after a forced collection is what the
 * program needs at its end, and it is the number the card's tables hold; but the collection costs seconds,
 * so only CI forces it, and it is the end and not the most the run ever held. The peak resident size is
 * exact everywhere, covers the whole run and sits a little over the heap. The warning reads the larger.
 */

/** The start of the hook's line on stderr. scripts/lib/tscMemoryHook.cjs writes the same words. */
export const MEMORY_MARK = 'tsc-memory-report:'
/** The hook, beside this file. */
export const HOOK_FILE = 'tscMemoryHook.cjs'
/** A run that held this share of its cap or more is near it. A fifth of a runner's 13,312 MB is about three weeks at 130 MB a day. */
export const NEAR_CAP_SHARE = 0.8
/** `1` forces the collection on any machine, `0` never forces it. Unset, CI forces it and a dev machine does not. */
export const COLLECT_ENV = 'TYPECHECK_COLLECT'
/** Where the numbers and the plan live. */
export const CARD = 'punch list #434, to-dos/type-check-in-parts.md'

const MB = 1024 * 1024
const KB = 1024

/** Whether tsc is given `--expose-gc`, so the hook can force one collection before it reads the heap. */
export function collects(env = {}) {
  if (env[COLLECT_ENV] === '1') return true
  if (env[COLLECT_ENV] === '0') return false
  return Boolean(env.CI) && env.CI !== 'false' && env.CI !== '0'
}

/** Node's own arguments, before tsc's path: the hook by its full path, and `--expose-gc` when the run collects. */
export function hookNodeArgs({ hookPath, collect }) {
  return collect ? ['--require', hookPath, '--expose-gc'] : ['--require', hookPath]
}

/**
 * Takes the hook's line out of a stream without keeping the stream.
 * `push(chunk)` answers the text to pass through, whole lines only; `end()` answers what was held back;
 * `raw()` answers the JSON text the hook wrote, or null when it wrote none (a heap death, a kill).
 */
export function memoryLineSplitter() {
  let partial = ''
  let found = null
  const take = (line, newline) => {
    const at = line.indexOf(MEMORY_MARK)
    if (at === -1) return line + newline
    found = line.slice(at + MEMORY_MARK.length)
    return at > 0 ? line.slice(0, at) + newline : ''
  }
  return {
    push(chunk) {
      const lines = (partial + String(chunk)).split('\n')
      partial = lines.pop() ?? ''
      return lines.map((line) => take(line, '\n')).join('')
    },
    end() {
      const rest = partial
      partial = ''
      return rest ? take(rest, '') : ''
    },
    raw() {
      return found
    },
  }
}

/**
 * The hook's JSON as numbers in MB, or null when it cannot be read.
 * `maxRss` is kilobytes by Node's docs and bytes on a Mac whose Node carries a libuv older than 1.45.
 * A peak is never under what is held now, so a `maxRss` at least half of `rssBytes` can only be bytes:
 * as kilobytes it would be a peak 500 times what the process holds as it exits.
 */
export function readMemoryReport(raw) {
  let o
  try {
    o = JSON.parse(String(raw))
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const heapUsed = Number(o.heapUsedBytes)
  const maxRss = Number(o.maxRss)
  const rss = Number(o.rssBytes)
  if (!(heapUsed > 0) || !(maxRss > 0)) return null
  const peakBytes = rss > 0 && maxRss >= rss / 2 ? maxRss : maxRss * KB
  return {
    heapUsedMb: Math.round(heapUsed / MB),
    residentPeakMb: Math.round(peakBytes / MB),
    collected: o.collected === true,
    collectMs: Number.isFinite(Number(o.collectMs)) ? Math.max(0, Number(o.collectMs)) : 0,
  }
}

/** The MB the warning reads: the larger of the heap in use at the end and the peak resident size. */
export function heldMb(report) {
  return Math.max(report.heapUsedMb, report.residentPeakMb)
}

/** True when the run held `NEAR_CAP_SHARE` of its cap or more. */
export function nearCap(report, capMb) {
  return capMb > 0 && heldMb(report) >= capMb * NEAR_CAP_SHARE
}

const mb = (n) => `${Math.round(n).toLocaleString('en-US')} MB`
const share = (n, capMb) => `${Math.round((n / capMb) * 100)}%`

/** `m:ss`, or `h:mm:ss` past an hour. */
export function wallWords(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** What the words call the run: its label when the caller gave one (a part's name), else plain tsc. */
const named = (label) => (label ? `${label}'s tsc` : 'tsc')

/**
 * The last line of every tsc that answered. `who` is `typecheck` or `build`, `label` the part's name.
 * A warm run holds about a third of a cold one, and the time says which this was.
 */
export function memoryWords({ who, label, report, capMb, wallMs }) {
  const heap = report.collected
    ? `ended holding ${mb(report.heapUsedMb)} of its ${mb(capMb)} heap (${share(report.heapUsedMb, capMb)}) after a collection of ${(report.collectMs / 1000).toFixed(1)} s`
    : `ended with ${mb(report.heapUsedMb)} of its ${mb(capMb)} heap in use (${share(report.heapUsedMb, capMb)}), not collected first`
  return `${who}: ${named(label)} took ${wallWords(wallMs)}, ${heap}, and held ${mb(report.residentPeakMb)} resident at most.`
}

/** The line a run near its cap gets after its memory line, or null. It is a warning: the check's answer stands. */
export function nearCapWords({ who, label, report, capMb }) {
  if (!nearCap(report, capMb)) return null
  const held = heldMb(report)
  return (
    `${who}: NEAR ITS HEAP. ${named(label)} held ${mb(held)} against a ${mb(capMb)} heap (${share(held, capMb)}), which leaves ${mb(Math.max(0, capMb - held))}. ` +
    `This is a warning and the check's answer stands. The program grows with the code and tsc dies at the cap with no verdict, so cut the program before then: ${CARD}.`
  )
}

/** A workflow command's message: GitHub reads `%`, a return and a line break as its own. */
function commandData(text) {
  return String(text).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

/**
 * The GitHub Actions line that puts the warning on the run's page and the pull request's checks, or null
 * anywhere else. The title holds no `:` and no `,`, which a command's property would need escaped.
 */
export function nearCapAnnotation({ words, label, env = {} }) {
  if (!words || env.GITHUB_ACTIONS !== 'true') return null
  const title = `The type check is near its heap${label ? ` (${label})` : ''}`
  return `::warning title=${commandData(title)}::${commandData(words)}`
}
