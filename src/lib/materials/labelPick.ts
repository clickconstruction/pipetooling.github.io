/**
 * Which strips Print labels prints (Taunya's ask of 2026-11-15, with a run of 455 strips stopped after five): a range
 * of boxes picked by its two ends, the run as its strips in order, and what a run that stopped part way has left, so
 * the next press prints the rest and nothing twice. The window keeps one set, the boxes left out, which every box's
 * chip shows, and at most one box that is part way through its copies. Pure. The window is `LabelsPrintModal.tsx`;
 * the printer's side of a stop is `endsTheRun` in `ptouchRaster.ts`.
 */
import { clampTapeCopies } from './tapeLabel'

// ── a range by its two ends ──────────────────────────────────────────────────────────────────

/** The labels beside the two ends of a range. */
export const LABEL_RANGE_FROM = 'From'
export const LABEL_RANGE_TO = 'to'

/** The first and the last ticked box, in the list's order; null when none is ticked. */
export function tickedRange(ids: ReadonlyArray<string>, left: ReadonlySet<string>): { fromId: string; toId: string } | null {
  const ticked = ids.filter((id) => !left.has(id))
  return ticked.length === 0 ? null : { fromId: ticked[0]!, toId: ticked[ticked.length - 1]! }
}

/**
 * The boxes left out once one end of the range is picked: every box between the two ends is ticked and every other
 * is not. The other end stays where it was (with nothing ticked: the list's far end), and an end picked past the
 * other pulls it along, so *From G40* over a range that ended at G12 is G40 alone.
 */
export function leftAfterRangePick(ids: ReadonlyArray<string>, left: ReadonlySet<string>, end: 'from' | 'to', id: string): Set<string> {
  const at = ids.indexOf(id)
  if (at < 0) return new Set(left)
  const now = tickedRange(ids, left)
  let from = end === 'from' ? at : now ? ids.indexOf(now.fromId) : 0
  let to = end === 'to' ? at : now ? ids.indexOf(now.toId) : ids.length - 1
  if (from > to) {
    if (end === 'from') to = from
    else from = to
  }
  return new Set(ids.filter((_, i) => i < from || i > to))
}

/**
 * Beside the two ends: how many that is. *86 of 91 boxes*; with chips unticked inside the range, *84 of 91 boxes, 2
 * left out between*; *No box is ticked.* `noun` is what the list holds, singular and plural.
 */
export function rangeCountWords(ids: ReadonlyArray<string>, left: ReadonlySet<string>, noun: readonly [string, string] = ['box', 'boxes']): string {
  const range = tickedRange(ids, left)
  if (!range) return `No ${noun[0]} is ticked.`
  const ticked = ids.filter((id) => !left.has(id)).length
  const holes = ids.indexOf(range.toId) - ids.indexOf(range.fromId) + 1 - ticked
  const of = `${ticked} of ${ids.length} ${ids.length === 1 ? noun[0] : noun[1]}`
  return holes > 0 ? `${of}, ${holes} left out between` : of
}

// ── the run as its strips ────────────────────────────────────────────────────────────────────

/** The one box a stopped run left part way through its copies: how many of `copies` are out. */
export type PartialBox = { id: string; done: number; copies: number }

/** One strip of a run: whose it is, and which of the box's copies, counted from 1. */
export type RunStrip = { id: string; copy: number }

/** The part-way box while it still means something: its box is ticked and the copies are what they were. */
export function partialThatHolds(partial: PartialBox | null, tickedIds: ReadonlyArray<string>, copies: number): PartialBox | null {
  if (!partial) return null
  const n = clampTapeCopies(copies)
  return partial.copies === n && partial.done > 0 && partial.done < n && tickedIds.includes(partial.id) ? partial : null
}

/**
 * The run as its strips in the order they print: each ticked box's copies together, 1 1 2 2. A box a stopped run left
 * part way prints only the copies it is missing, so nothing comes out twice and no box comes up short.
 */
export function runStrips(tickedIds: ReadonlyArray<string>, copies: number, partial: PartialBox | null = null): RunStrip[] {
  const n = clampTapeCopies(copies)
  const held = partialThatHolds(partial, tickedIds, n)
  return tickedIds.flatMap((id) => {
    const first = held && held.id === id ? held.done + 1 : 1
    return Array.from({ length: n - first + 1 }, (_, i) => ({ id, copy: first + i }))
  })
}

/**
 * What a run that ended after `done` of its strips has left: the boxes whose last copy went, to untick, and the one
 * box part way through its copies, if any. A run that printed every strip leaves neither.
 */
export function afterStop(strips: ReadonlyArray<RunStrip>, done: number, copies: number): { wholeIds: string[]; partial: PartialBox | null } {
  const n = clampTapeCopies(copies)
  const out = new Map<string, number>()
  for (const strip of strips.slice(0, Math.max(0, done))) out.set(strip.id, strip.copy)
  const wholeIds: string[] = []
  let partial: PartialBox | null = null
  for (const [id, copy] of out) {
    if (copy >= n) wholeIds.push(id)
    else partial = { id, done: copy, copies: n }
  }
  return { wholeIds, partial }
}

/**
 * Under *7 of 455 printed, then you stopped the run.*: which boxes are done, which is part way, and what the press
 * does now. `whole` are the names of the boxes printed whole, in the order they went; `partial` the part-way box's
 * name with how many strips it is missing; `rest` how many strips the press would print.
 */
export function stoppedDetailWords(whole: ReadonlyArray<string>, partial: { name: string; toGo: number; copies: number } | null, rest: number): string {
  const parts: string[] = []
  if (whole.length === 1) parts.push(`${whole[0]} is done and unticked.`)
  else if (whole.length === 2) parts.push(`${whole[0]} and ${whole[1]} are done and unticked.`)
  else if (whole.length > 2) parts.push(`${whole[0]} to ${whole[whole.length - 1]} are done and unticked.`)
  if (partial) parts.push(`${partial.name} has ${partial.toGo} of its ${partial.copies} strips to go.`)
  if (rest > 0) parts.push('The press prints the rest.')
  return parts.join(' ')
}

/** The line under the window's title while a part-way box is owed strips: *90 boxes, 447 strips to go.* */
export function restCountWords(boxes: number, strips: number): string {
  return `${boxes} ${boxes === 1 ? 'box' : 'boxes'}, ${strips} ${strips === 1 ? 'strip' : 'strips'} to go.`
}

// ── a stopped run kept through a closed window ───────────────────────────────────────────────

/**
 * A run that stopped part way, as this device keeps it for the rest of the day (Taunya, 2026-11-15: the tape ran out
 * half way through G37, and a window closed to change it came back with every box ticked). The job, the day, the
 * copies, the boxes left out and the one part way.
 */
export type StoppedRun = { jobId: string; day: string; copies: number; left: string[]; partial: PartialBox | null }

/** What to keep after a run ends part way; null when there is no job to key it by. */
export function stoppedRunToKeep(jobId: string | null | undefined, day: string, copies: number, left: ReadonlySet<string>, partial: PartialBox | null): StoppedRun | null {
  if (!jobId) return null
  return { jobId, day, copies: clampTapeCopies(copies), left: [...left], partial }
}

/** A kept run read back from storage: the shape checked, since anything may be in a browser's store. */
export function stoppedRunOf(value: unknown): StoppedRun | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.jobId !== 'string' || typeof v.day !== 'string' || !Array.isArray(v.left) || !v.left.every((id) => typeof id === 'string')) return null
  const copies = clampTapeCopies(v.copies)
  const p = v.partial as Record<string, unknown> | null | undefined
  const partial = p && typeof p.id === 'string' && Number.isInteger(p.done) && Number.isInteger(p.copies) ? { id: p.id, done: p.done as number, copies: p.copies as number } : null
  return { jobId: v.jobId, day: v.day, copies, left: v.left as string[], partial }
}

/**
 * The kept run as the window opens on it: only for the same job on the same day, only the boxes the job still has,
 * and only while something is left to print. Anything else is a fresh window with every box ticked.
 */
export function stoppedRunToResume(kept: StoppedRun | null, jobId: string | null | undefined, today: string, ids: ReadonlyArray<string>): { left: Set<string>; partial: PartialBox | null; copies: number } | null {
  if (!kept || !jobId || kept.jobId !== jobId || kept.day !== today) return null
  const left = new Set(kept.left.filter((id) => ids.includes(id)))
  const ticked = ids.filter((id) => !left.has(id))
  if (ticked.length === 0) return null
  const partial = partialThatHolds(kept.partial, ticked, kept.copies)
  // A run stopped inside its first box has no box done, only one part way: that is still a run to pick up.
  if (left.size === 0 && !partial) return null
  return { left, partial, copies: kept.copies }
}

/**
 * Said when the window opens on a kept run: *Picked up where today's run stopped. 36 boxes are done and unticked.
 * G37 has 3 of its 5 strips to go. Press Every box to start over.*
 */
export function resumedRunWords(done: number, partial: { name: string; toGo: number; copies: number } | null): string {
  const parts = ['Picked up where today’s run stopped.']
  if (done > 0) parts.push(done === 1 ? '1 box is done and unticked.' : `${done} boxes are done and unticked.`)
  if (partial) parts.push(`${partial.name} has ${partial.toGo} of its ${partial.copies} strips to go.`)
  parts.push('Press Every box to start over.')
  return parts.join(' ')
}
