/**
 * The crew's job window on a phone (punch list #355, direction C, the crew half, v2.7355): the plain window that
 * helpers, the superintendent, subs and estimators open, drawn in the order PR B gave the tabbed window's Job tab.
 * The name first with the status, then Where · Photos · Who · What's happening, and the rest folded under More on
 * this job. Pure: the quiet line, the scheduled block's label, the newest note as a row, the ⋯ sheet's rows and the
 * folds; the screen is `DetailJobModal` outside pane mode.
 */
import { whenWords } from '../messages/thread'
import { jobWindowSheetRows, type JobWindowSheetDoors, type JobWindowSheetRow } from './jobWindowPhone'

// ---------------------------------------------------------------------------
// The title
// ---------------------------------------------------------------------------

/** The quiet line under the name: the job's number, then the customer. A part with nothing in it is left out. */
export function crewQuietLine(input: { number: string | null | undefined; customer: string | null | undefined }): string[] {
  return [input.number, input.customer].map((p) => (p ?? '').trim()).filter(Boolean)
}

// ---------------------------------------------------------------------------
// What's happening
// ---------------------------------------------------------------------------

/** The block the window was opened from: *Next on site* while its day is today or ahead, *Was scheduled* once it has passed. */
export function crewBlockLabel(workDate: string, todayYmd: string): string {
  return workDate >= todayYmd ? 'Next on site' : 'Was scheduled'
}

/** A note or a report as the row needs it: the words, who wrote them and when. */
export type CrewNoteSource = { kind: 'note'; body: string; author: string | null; at: string } | { kind: 'report'; template: string; author: string | null; at: string }

export type LastNoteWords = {
  /** The note's own words, cut at a word when long; a report reads by its name. */
  value: string
  /** *Dana Reyes, yesterday* */
  sub: string
}

export const LAST_NOTE_MAX = 90

/** A note cut at the last word that fits, with … after it. */
export function clipNote(body: string, max = LAST_NOTE_MAX): string {
  const text = body.replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

/** The newest note or report on the job as one row, or null with none. */
export function lastNoteWords(items: readonly CrewNoteSource[], nowIso: string): LastNoteWords | null {
  const newest = items.reduce<CrewNoteSource | null>((best, item) => (!best || item.at > best.at ? item : best), null)
  if (!newest) return null
  const who = (newest.author ?? '').trim() || 'Someone'
  const value = newest.kind === 'note' ? clipNote(newest.body) : (newest.template.trim() || 'Report')
  if (!value) return null
  return { value, sub: `${who}, ${whenWords(newest.at, nowIso)}` }
}

// ---------------------------------------------------------------------------
// The ⋯ sheet
// ---------------------------------------------------------------------------

/** The plain window's ⋯ rows: the tabbed window's doors that are open to this viewer, without the ? card it does not have. */
export function crewSheetRows(doors: JobWindowSheetDoors): JobWindowSheetRow[] {
  return jobWindowSheetRows(doors).filter((r) => r.key !== 'legend')
}

// ---------------------------------------------------------------------------
// More on this job: the crew's folds, remembered per device
// ---------------------------------------------------------------------------

export type CrewFoldKey = 'notes' | 'plans' | 'accounts' | 'parts'

export const CREW_FOLD_TITLES: Record<CrewFoldKey, string> = {
  notes: 'Notes and reports',
  plans: 'Plans',
  accounts: 'Job accounts',
  parts: 'Parts cost',
}

/**
 * The folds this viewer gets, in order. Notes and Plans are everyone's; Job accounts is drawn once the job has a
 * supply house on its list; Parts cost is for the roles that read it today (the superintendent and the estimators).
 */
export function crewFolds(input: { accounts: boolean; parts: boolean }): CrewFoldKey[] {
  const keys: CrewFoldKey[] = ['notes', 'plans']
  if (input.accounts) keys.push('accounts')
  if (input.parts) keys.push('parts')
  return keys
}

export const CREW_FOLDS_KEY = 'job_window_crew_folds_open'

/** Which folds this phone keeps open; none until someone opens one. */
export function readCrewFolds(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): Set<CrewFoldKey> {
  try {
    const raw = storage?.getItem(CREW_FOLDS_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((k): k is CrewFoldKey => typeof k === 'string' && k in CREW_FOLD_TITLES))
  } catch {
    return new Set()
  }
}

export function keepCrewFolds(open: ReadonlySet<CrewFoldKey>, storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(CREW_FOLDS_KEY, JSON.stringify([...open]))
  } catch {
    // A browser that refuses storage forgets the folds on the next open; nothing else changes.
  }
}
