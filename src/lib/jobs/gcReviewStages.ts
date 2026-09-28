/**
 * GC Review stages: where the week stands and where each GC is in it. Every
 * worklist row already has one next step (check, send, word, or none), so a
 * GC is *at* exactly one stage — counting them per stage is the track over
 * the list, and the same key filters the list to the GCs waiting there.
 * Pure: the worklist goes in.
 */
import type { GcWorklist, GcWorklistGroup, GcWorklistRow, GcWorklistStep } from './gcWorklist'

export type GcStageKey = GcWorklistStep | 'done'

export const GC_STAGE_ORDER: readonly GcStageKey[] = ['check', 'send', 'word', 'done']

export type GcStageStop = {
  key: GcWorklistStep
  /** 1-based, as drawn in the stop's circle. */
  n: number
  name: string
  /** GCs whose next step is this one, and what they owe together. */
  waiting: number
  waitingTotal: number
  /** How many GCs have this step behind them, of how many owe it this week. */
  done: number
  of: number
  complete: boolean
}

export type GcStageTrack = {
  stops: GcStageStop[]
  /** The first stage with a GC waiting — where the work is; 'done' when the week is finished. */
  here: GcStageKey
  /** GCs with no step left, of every GC in the week. Skipped GCs have no step left and are counted apart. */
  finished: { done: number; skipped: number; of: number }
}

/** The stage a GC is at: its next step, or done once nothing is left (a skipped GC has nothing left). */
export function gcRowStage(row: Pick<GcWorklistRow, 'next'>): GcStageKey {
  return row.next ?? 'done'
}

const STOP_NAMES: Record<GcWorklistStep, string> = { check: 'Check', send: 'Send', word: 'Word' }

/** Has this row put the step behind it? A re-check (bills changed after sign-off) is not behind it. */
const stepDone = (row: GcWorklistRow, step: GcWorklistStep): boolean => (step === 'check' ? row.checked === 'done' : step === 'send' ? row.sent : row.word)

/** Does the week ask this step of the row? The word only over the line; a skipped GC owes only what it already did. */
const stepOwed = (row: GcWorklistRow, step: GcWorklistStep): boolean => {
  if (step === 'word' && !row.overLine) return false
  return !row.skipped || stepDone(row, step)
}

export function buildGcStageTrack(worklist: Pick<GcWorklist, 'groups'>): GcStageTrack {
  const rows = worklist.groups.flatMap((g) => g.rows)
  const stops = (['check', 'send', 'word'] as const).map((key, i): GcStageStop => {
    const waiting = rows.filter((r) => r.next === key)
    const owed = rows.filter((r) => stepOwed(r, key))
    const done = owed.filter((r) => stepDone(r, key)).length
    return {
      key,
      n: i + 1,
      name: STOP_NAMES[key],
      waiting: waiting.length,
      waitingTotal: waiting.reduce((t, r) => t + r.amount, 0),
      done,
      of: owed.length,
      complete: owed.length > 0 && done >= owed.length,
    }
  })
  return {
    stops,
    here: stops.find((s) => s.waiting > 0)?.key ?? 'done',
    finished: {
      done: rows.filter((r) => r.next == null && !r.skipped).length,
      skipped: rows.filter((r) => r.skipped).length,
      of: rows.length,
    },
  }
}

/** "1 to check" / "10 to send" / "2 words due"; "all checked" once nothing is owed; "none waiting" while the GCs are still upstream. */
export function gcStageStopLabel(stop: Pick<GcStageStop, 'key' | 'waiting' | 'complete'>): string {
  if (stop.complete) return stop.key === 'check' ? 'all checked' : stop.key === 'send' ? 'all sent' : 'all words in'
  if (stop.waiting === 0) return 'none waiting'
  if (stop.key === 'word') return `${stop.waiting} word${stop.waiting === 1 ? '' : 's'} due`
  return `${stop.waiting} to ${stop.key}`
}

/** What the GCs at a stage are waiting on — the filter line's words. */
export const GC_STAGE_WAITING_ON: Record<GcStageKey, string> = {
  check: 'waiting to be checked',
  send: 'checked and waiting to go out',
  word: 'sent and waiting on the word',
  done: 'finished for the week',
}

/**
 * The list under the track. With a stage picked, only the GCs at it, and only
 * the groups that still hold one. Either way a broken promise comes first,
 * then the earliest stage — so the row the track points at is on top — then
 * the largest balance.
 */
export function gcWorklistAtStage(worklist: Pick<GcWorklist, 'groups'>, stage: GcStageKey | null): { groups: GcWorklistGroup[]; shown: number; shownTotal: number; of: number } {
  const rank = (r: GcWorklistRow) => GC_STAGE_ORDER.indexOf(gcRowStage(r))
  let shown = 0
  let shownTotal = 0
  let of = 0
  const groups = worklist.groups.flatMap((g) => {
    of += g.rows.length
    const rows = g.rows
      .filter((r) => stage == null || gcRowStage(r) === stage)
      .sort((a, b) => Number(b.promise?.late ?? false) - Number(a.promise?.late ?? false) || rank(a) - rank(b) || b.amount - a.amount || a.gcName.localeCompare(b.gcName))
    if (rows.length === 0) return []
    shown += rows.length
    shownTotal += rows.reduce((t, r) => t + r.amount, 0)
    return [{ ...g, rows }]
  })
  return { groups, shown, shownTotal, of }
}
