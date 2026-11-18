/**
 * Take from a box (the owner's ask of 2026-11-18): a person who takes parts out of a cage photographs it as found,
 * says what they take, and photographs it after. One run does all three. **Take from G12** opens the camera; the run's
 * screen asks what was taken; **Take 3 from G12** writes the ledger rows and opens the camera again. The photos are
 * asked for and never required, and the take is saved before the photo after, so a camera that will not open costs a
 * picture and never a take.
 *
 * A take is not a row. It is an id minted on the phone and written on every row the run makes (`take_id` on
 * `job_material_movements` and `job_box_photos`, `kind` on the photo: `20261118130000_box_takes.sql`).
 *
 * Measured on the day it was drawn: 81 of 93 live boxes hold one kind of part. So a box with one line asks only how
 * many, on the number sheet a person already knows, opened on 1; a box with more lists them, a tap a piece.
 *
 * Pure: no clock, no storage. The run kept on the phone is `takeRunMemory.ts`; the screen is `TakeRun.tsx`.
 */
import type { ContainerLine, Movement, MovementReason } from './onSite'

/** A ledger row as the store reads it since the take columns: the kernel's row with the take it belongs to. */
export type TakeMovement = Movement & { takeId?: string | null }

export function takeIdOf(m: Movement): string | null {
  return (m as TakeMovement).takeId ?? null
}

export type TakePhotoKind = 'before' | 'after'

/** A part the box's list does not hold, named by the person who took it. */
export type TakeExtra = { partId: string | null; partName: string; manufacturer: string | null; n: number }

export type TakeRun = {
  /** The take's id, minted on the phone: every row and photo of the run carries it. */
  id: string
  jobId: string
  containerId: string
  startedAt: string
  /** How many of each line, by part key. */
  marks: Record<string, number>
  extras: TakeExtra[]
  /** Set once the rows are written: only the photo after is owed. */
  savedAt: string | null
  /** How many pieces the saved take took, for the words after a reload. */
  savedCount: number
}

/** The most one line of a take may say: the number sheet's own ceiling for a part with no count to hold it to. */
export const TAKE_MAX = 9999

/** A run nobody finished closes by itself after this long: the photo as found stays, with nothing marked. */
export const TAKE_OPEN_MS = 12 * 60 * 60 * 1000

/** The note on a row the run writes for pieces the app did not know the box held. */
export const TAKE_FOUND_NOTE = 'found during a take'

/** A box whose list is one line asks only how many. */
export function takeIsOnePart(lines: ReadonlyArray<ContainerLine>): boolean {
  return lines.length === 1
}

/** A new run: a one-part box opens on 1, since one is what a person most often takes. */
export function newTakeRun(input: { id: string; jobId: string; containerId: string; lines: ReadonlyArray<ContainerLine>; now: string }): TakeRun {
  const only = takeIsOnePart(input.lines) ? input.lines[0] : null
  return { id: input.id, jobId: input.jobId, containerId: input.containerId, startedAt: input.now, marks: only ? { [only.partKey]: 1 } : {}, extras: [], savedAt: null, savedCount: 0 }
}

function clampCount(n: number): number {
  return Number.isFinite(n) ? Math.min(TAKE_MAX, Math.max(0, Math.round(n))) : 0
}

/** The run with one line set to `n`; none takes the line off. */
export function takeMark(run: TakeRun, partKey: string, n: number): TakeRun {
  const marks = { ...run.marks }
  const v = clampCount(n)
  if (v > 0) marks[partKey] = v
  else delete marks[partKey]
  return { ...run, marks }
}

export function takeAddExtra(run: TakeRun, extra: TakeExtra): TakeRun {
  const name = extra.partName.trim()
  const n = clampCount(extra.n)
  if (!name || n <= 0) return run
  return { ...run, extras: [...run.extras, { ...extra, partName: name, n }] }
}

export function takeRemoveExtra(run: TakeRun, index: number): TakeRun {
  return { ...run, extras: run.extras.filter((_, i) => i !== index) }
}

/** Pieces in the take, the listed lines and the unlisted parts together. */
export function takeTotal(run: TakeRun): number {
  return Object.values(run.marks).reduce((s, n) => s + n, 0) + run.extras.reduce((s, e) => s + e.n, 0)
}

/** Kinds of part in the take. */
export function takeLineCount(run: TakeRun): number {
  return Object.values(run.marks).filter((n) => n > 0).length + run.extras.length
}

/** The press that starts a run, and the run's title. */
export function takeStartLabel(containerLabel: string): string {
  return `Take from ${containerLabel}`
}

/** The press that saves a take says its count; with nothing marked it is dead and says what to do. */
export function takeSaveLabel(run: TakeRun, containerLabel: string, onePart: boolean): string {
  const n = takeTotal(run)
  if (n > 0) return `Take ${n} from ${containerLabel}`
  return onePart ? 'Say how many' : 'Tap what you take'
}

/** Under a line: what the box has, or what it will have left. Past what the app counted, the rest is found. */
export function takeLineHint(containerLabel: string, onHand: number, n: number): string {
  const has = Math.max(0, onHand)
  if (n <= 0) return `${containerLabel} has ${has}`
  if (n <= has) return `Taking ${n}. ${containerLabel} will have ${has - n === 0 ? 'none' : has - n} left.`
  return `Taking ${n}. The app counted ${has}. The other ${n - has} ${n - has === 1 ? 'is' : 'are'} recorded as found.`
}

/** The quick numbers beside a count, under what the box has, and the whole line. */
export function takeQuicks(onHand: number, base: ReadonlyArray<number> = [1, 2, 5, 10]): number[] {
  return base.filter((v) => v < onHand)
}

export type TakeRow = { reason: MovementReason; partId: string | null; partName: string; manufacturer: string | null; quantity: number; fromContainerId: string | null; toContainerId: string | null; note: string }

/**
 * The ledger rows a take writes, in order. A taken piece is a Used row from the box. Where a person takes more than
 * the app counted, or a part the list never held, a Delivered row into the box comes first with the note *found
 * during a take*, so the box's number never goes under zero and the office reads that the pieces were there.
 */
export function takeRows(run: TakeRun, lines: ReadonlyArray<ContainerLine>): TakeRow[] {
  const out: TakeRow[] = []
  const box = run.containerId
  for (const l of lines) {
    const n = run.marks[l.partKey] ?? 0
    if (n <= 0) continue
    const found = n - Math.max(0, l.onHand)
    if (found > 0) out.push({ reason: 'delivered', partId: l.partId, partName: l.partName, manufacturer: l.manufacturer, quantity: found, fromContainerId: null, toContainerId: box, note: TAKE_FOUND_NOTE })
    out.push({ reason: 'used', partId: l.partId, partName: l.partName, manufacturer: l.manufacturer, quantity: n, fromContainerId: box, toContainerId: null, note: '' })
  }
  for (const e of run.extras) {
    out.push({ reason: 'delivered', partId: e.partId, partName: e.partName, manufacturer: e.manufacturer, quantity: e.n, fromContainerId: null, toContainerId: box, note: TAKE_FOUND_NOTE })
    out.push({ reason: 'used', partId: e.partId, partName: e.partName, manufacturer: e.manufacturer, quantity: e.n, fromContainerId: box, toContainerId: null, note: '' })
  }
  return out
}

/** The run with its rows written: only the photo after is owed. */
export function takeSaved(run: TakeRun, now: string): TakeRun {
  return { ...run, savedAt: now, savedCount: takeTotal(run) }
}

/** What a take's photo is of, as its file is named: "G12 as found", "G12 after a take". */
export function takePhotoWords(containerLabel: string, kind: TakePhotoKind): string {
  return kind === 'before' ? `${containerLabel} as found` : `${containerLabel} after a take`
}

/** A run older than `TAKE_OPEN_MS` is closed: the phone forgets it, and the rows say it was left. */
export function takeIsStale(run: Pick<TakeRun, 'startedAt'>, nowMs: number): boolean {
  const started = new Date(run.startedAt).getTime()
  return !Number.isFinite(started) || nowMs - started > TAKE_OPEN_MS
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/** The strip over a box whose run was left: started and not saved, or saved with no photo after. */
export function takeLeftWords(run: TakeRun, containerLabel: string): { main: string; sub: string; go: string; drop: string } {
  if (run.savedAt) {
    return { main: `You took ${run.savedCount} from ${containerLabel} at ${clock(run.savedAt)}.`, sub: `No photo of ${containerLabel} after yet. The take is saved.`, go: 'Take the photo', drop: 'Finish without it' }
  }
  return { main: `You started a take from ${containerLabel} at ${clock(run.startedAt)}.`, sub: 'Nothing is taken yet.', go: 'Finish it', drop: 'Nothing taken' }
}

/** The toast when a run ends. */
export function takeDoneWords(count: number, containerLabel: string, photoAfter: boolean): string {
  return photoAfter ? `${count} taken from ${containerLabel}. The photo after is kept.` : `${count} taken from ${containerLabel}. No photo after.`
}
