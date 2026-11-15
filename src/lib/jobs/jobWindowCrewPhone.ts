/**
 * The crew's job window on a phone (punch list #355, direction C, the crew half, v2.7355): the plain window that
 * helpers, the superintendent, subs and estimators open, drawn in the order PR B gave the tabbed window's Job tab.
 * The name first with the status, then Where · Photos · Who · Today's work · What's happening, and the rest folded
 * under More on this job. Pure: the quiet line, the open stage's card, the scheduled block's label, the newest note
 * as a row, the ⋯ sheet's rows and the folds; the screen is `DetailJobModal` outside pane mode.
 */
import { whenWords } from '../messages/thread'
import { defaultOpenLine, jobPercentFromLines, lineIsDone } from '../reports/lineProgressReport'
import { stageEffectivePct, type StageProgressRow } from '../reports/stageProgressReport'
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
// Today's work: the open stage (v2.7376)
// ---------------------------------------------------------------------------

export type CrewStageCard = {
  /** The stage the crew is on, or *Every stage is done*. */
  title: string
  /** *Rough In done · Top Out 40% · Trim Set not started*; a long job reads *3 of 8 done · Trim Set open*. */
  line: string
  /** The job by its stages, 0 to 100: the bar. */
  pct: number
  allDone: boolean
}

/** Past this many stages the line counts the done ones instead of naming each. */
export const STAGE_LINE_MAX = 4

/**
 * The open stage as a card, from the job's stages as the report form reads them (`list_job_stage_progress`). The
 * open stage is the one the report form opens on by itself: the first stage in order not yet done, else the first
 * any-time line not done. Null for a job with fewer than two stages: it has no stage to be on, and its one line is
 * the bid's price, not a word the crew uses.
 */
export function crewStageCard(rows: readonly StageProgressRow[] | null | undefined): CrewStageCard | null {
  if (!rows || rows.length < 2) return null
  const open = defaultOpenLine(rows)
  const done = rows.filter((r) => lineIsDone(r, {}))
  const pct = jobPercentFromLines(rows, {})
  if (!open) return { title: 'Every stage is done', line: `${rows.length} of ${rows.length} done`, pct: 100, allDone: true }
  const word = (r: StageProgressRow): string => {
    if (lineIsDone(r, {})) return `${r.name} done`
    const at = stageEffectivePct(r)
    if (at > 0) return `${r.name} ${at}%`
    return r === open ? `${r.name} open` : `${r.name} not started`
  }
  const line = rows.length <= STAGE_LINE_MAX ? rows.map(word).join(' · ') : `${done.length} of ${rows.length} done · ${word(open)}`
  return { title: open.name, line, pct, allDone: false }
}

/** The Materials on site fold's quiet words: *2 containers · 14 lines*, *nothing yet* for a site with none, '' before the read lands. */
export function crewMaterialsWords(input: { loaded: boolean; containers: number; lines: number }): string {
  if (!input.loaded) return ''
  if (input.containers === 0) return 'nothing yet'
  return `${input.containers} ${input.containers === 1 ? 'container' : 'containers'} · ${input.lines} ${input.lines === 1 ? 'line' : 'lines'}`
}

// ---------------------------------------------------------------------------
// The crew's folds, remembered per device
// ---------------------------------------------------------------------------

export type CrewFoldKey = 'notes' | 'plans' | 'materials' | 'accounts' | 'parts'

export const CREW_FOLD_TITLES: Record<CrewFoldKey, string> = {
  notes: 'Notes and reports',
  plans: 'Plans',
  materials: 'Materials on site',
  accounts: 'Job accounts',
  parts: 'Parts cost',
}

/** Today's work's two folds, under the open stage and its checklists: everyone on the crew gets both. */
export const CREW_WORK_FOLDS: readonly CrewFoldKey[] = ['plans', 'materials']

/**
 * More on this job's folds for this viewer, in order. Notes is everyone's; Job accounts is drawn once the job has a
 * supply house on its list; Parts cost is for the roles that read it today (the superintendent and the estimators).
 * Plans moved up into Today's work in v2.7376.
 */
export function crewFolds(input: { accounts: boolean; parts: boolean }): CrewFoldKey[] {
  const keys: CrewFoldKey[] = ['notes']
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
