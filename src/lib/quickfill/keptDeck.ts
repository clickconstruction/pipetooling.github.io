import { buildKeptReadKey, formatKeptReadTime, type KeptReadTimeFormat } from '../keptRead'
import { roundRows, type RoundCountSource, type RoundEvent, type RoundMark, type RoundRow, type RoundSectionInput } from './round'

/**
 * Quickfill's kept deck (punch list #183 PR 4): the shape the Roller and the phone's round keep on
 * the device through `useKeptRead`, so a slow morning shows the deck as read at 7:52 AM, each
 * station's count and Next line with it, under the stamp *Counts from 7:52 AM · counting again…*
 * instead of the chips over a blank page. Done and Worked it are held on a kept station until the
 * live read lands; Skip and Not sure stay live.
 *
 * What is kept is the view model the deck draws, never the raw tables: one row per station in the
 * round with its label, its count and where the count came from, its Next line, its last mark and
 * the last five marks' times. The round's state (due, due today, fresh) is NOT kept: it is a
 * question of the clock, so `quickfillKeptDeckRows` re-asks the round's own kernel with the kept
 * marks and the time the deck is drawn, and a station marked at 7:50 reads as due again by evening
 * rather than as fresh all day.
 *
 * The key is `u1:quickfill:deck`: one deck per person on a device. The role decides which stations
 * are in it, and a station hidden by a dev leaves the deck with the next live read.
 */

export const QUICKFILL_KEPT_PAGE = 'quickfill'

/** The one scope: the whole deck, or nothing. */
export const QUICKFILL_KEPT_SCOPES: readonly string[] = ['deck']

export function quickfillKeptKey(userId: string): string {
  return buildKeptReadKey(userId, QUICKFILL_KEPT_PAGE, 'deck')
}

/** How many of a station's last marks ride with the kept row: enough for the rhythm rule (`ROUND_RHYTHM_WINDOW`). */
export const QUICKFILL_KEPT_MARKS_PER_STATION = 5

export type QuickfillKeptRow = {
  sectionId: string
  label: string
  personal: boolean
  needsNote: boolean
  /** The count as the deck last drew it, null with none. */
  count: number | null
  /** Live when the station counted this visit, at last look from the mark history, or none. */
  countSource: RoundCountSource
  /** The station's Next line as reported, null when it had nothing to say or had not counted. */
  nextLine: string | null
  lastMarkedAt: string | null
  lastMarkedByName: string | null
  /** The last marks' times, newest first, for the rhythm rule. */
  markedAts: string[]
}

/** The last five marks of each station from the 60-day history, newest first, for the rows' `markedAts`. */
export function keptMarkedAtsBySection(events: ReadonlyArray<RoundEvent>): ReadonlyMap<string, string[]> {
  const by = new Map<string, string[]>()
  for (const e of events) {
    if (!e || typeof e.section_id !== 'string' || typeof e.marked_at !== 'string') continue
    const arr = by.get(e.section_id) ?? []
    arr.push(e.marked_at)
    by.set(e.section_id, arr)
  }
  for (const [id, arr] of by) {
    arr.sort((a, b) => Date.parse(b) - Date.parse(a))
    by.set(id, arr.slice(0, QUICKFILL_KEPT_MARKS_PER_STATION))
  }
  return by
}

/**
 * The rows to keep once the marks, the history, the layout and the on-screen station's count all
 * landed: the deck's rows as drawn, each with its Next line and its last marks.
 */
export function buildQuickfillKeptRows(args: {
  rows: ReadonlyArray<RoundRow>
  nextLineOf: (sectionId: string) => string | null
  markedAtsOf: ReadonlyMap<string, string[]>
}): QuickfillKeptRow[] {
  return args.rows.map((r) => ({
    sectionId: r.sectionId,
    label: r.label,
    personal: r.personal,
    needsNote: r.needsNote,
    count: r.count,
    countSource: r.countSource,
    nextLine: r.countSource === 'open' ? (args.nextLineOf(r.sectionId) ?? null) : null,
    lastMarkedAt: r.lastMarkedAt,
    lastMarkedByName: r.lastMarkedByName,
    markedAts: [...(args.markedAtsOf.get(r.sectionId) ?? [])],
  }))
}

/**
 * The kept rows back into the deck the Roller and the round draw, with the round's state read
 * against `now` rather than the time the deck was kept. The kept counts stand as they were: a live
 * count is handed to the kernel as the station's live count, an at-last-look count rides on the
 * newest kept mark as the history's snapshot, so each row's `countSource` reads as it did.
 */
export function quickfillKeptDeckRows(kept: ReadonlyArray<QuickfillKeptRow>, now: Date): RoundRow[] {
  const sections: RoundSectionInput[] = kept.map((r) => ({ sectionId: r.sectionId, label: r.label, personal: r.personal, needsNote: r.needsNote }))
  const marks: Record<string, RoundMark | undefined> = {}
  const events: RoundEvent[] = []
  const live = new Map<string, number>()
  for (const r of kept) {
    if (r.lastMarkedAt) marks[r.sectionId] = { marked_at: r.lastMarkedAt, marked_by_name: r.lastMarkedByName }
    if (r.countSource === 'open' && typeof r.count === 'number') live.set(r.sectionId, r.count)
    r.markedAts.forEach((at, i) => {
      events.push({ section_id: r.sectionId, marked_at: at, outstanding_count: i === 0 && r.countSource === 'last_look' && typeof r.count === 'number' ? r.count : null })
    })
    // A last-look count with no mark in the window: carry it on the last mark itself.
    if (r.countSource === 'last_look' && typeof r.count === 'number' && r.markedAts.length === 0 && r.lastMarkedAt) {
      events.push({ section_id: r.sectionId, marked_at: r.lastMarkedAt, outstanding_count: r.count })
    }
  }
  return roundRows(sections, marks, events, (id) => live.get(id) ?? null, now)
}

const COUNT_SOURCES: ReadonlySet<string> = new Set(['open', 'last_look', 'none'])

/** A stored row off the shape voids the kept deck. */
export function quickfillKeptRowIsValid(row: unknown): boolean {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  if (typeof r.sectionId !== 'string' || r.sectionId.length === 0) return false
  if (typeof r.label !== 'string') return false
  if (typeof r.personal !== 'boolean' || typeof r.needsNote !== 'boolean') return false
  if (r.count != null && typeof r.count !== 'number') return false
  if (typeof r.countSource !== 'string' || !COUNT_SOURCES.has(r.countSource)) return false
  if (r.nextLine != null && typeof r.nextLine !== 'string') return false
  if (r.lastMarkedAt != null && typeof r.lastMarkedAt !== 'string') return false
  if (r.lastMarkedByName != null && typeof r.lastMarkedByName !== 'string') return false
  if (!Array.isArray(r.markedAts) || r.markedAts.some((s) => typeof s !== 'string')) return false
  return true
}

/**
 * A kept station's count line on the Roller and the round: *3 open at 7:52 AM* when the station
 * counted at the kept read; empty when the kept count is the history's or there is none, since the
 * row under the name already says *at last look*.
 */
export function quickfillKeptCountLine(row: Pick<QuickfillKeptRow, 'count' | 'countSource'> | null | undefined, readAt: number, format: KeptReadTimeFormat = {}): string {
  if (!row || row.countSource !== 'open' || typeof row.count !== 'number') return ''
  return `${row.count} open at ${formatKeptReadTime(readAt, format)}`
}

/**
 * Whether the deck's live read is still out, for the hook's `loading`: the marks, the 60-day
 * history and the layout settings must all have landed, and so must the count of the station on
 * screen (a personal door has no count). Nothing else is waited for: the other stations' counts
 * come from the history, which is what the deck draws for them.
 */
export function quickfillDeckLoading(args: {
  marksLoaded: boolean
  eventsLoaded: boolean
  layoutLoaded: boolean
  /** The station on screen, null when the Roller or the round shows none. */
  stationOnScreen: string | null
  personal: (sectionId: string) => boolean
  /** The station's reported metric, undefined before its reporter registers. */
  metricOf: (sectionId: string) => { loading: boolean } | undefined
}): boolean {
  if (!args.marksLoaded || !args.eventsLoaded || !args.layoutLoaded) return true
  const id = args.stationOnScreen
  if (!id || args.personal(id)) return false
  const m = args.metricOf(id)
  return !m || m.loading
}

/**
 * Which stations' page-level reads run (the Roller's read diet, #183's argument *The fix belongs in
 * the reads*): on the Page and in Focus every station is on screen, so every read runs; on the
 * Roller and the phone's round only the station on screen reads, and the deck draws the others'
 * counts from the mark history, *at last look*, as the phone always has.
 */
export function quickfillStationReadsOn(args: { everyStationOnScreen: boolean; stationOnScreen: string | null; sectionId: string }): boolean {
  return args.everyStationOnScreen || args.stationOnScreen === args.sectionId
}
