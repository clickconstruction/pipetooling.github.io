/**
 * A job as its own screen on a phone's Lien desk (punch list #352, PR 4).
 *
 * A row of the first view says a job, what it owes and one press. A tap on the row opens that job alone: when its
 * paper is due, the four steps written out, the doors to its paper, its Lien window and the job, and the row's own
 * press pinned at the foot. Every word here is one the desk already says: the due line and the steps are the step
 * card's (`lienStepCard`), the press is the row's button, the doors open what the chip and the job's name open.
 *
 * Pure. It builds what the screen says from a row the desk already made; it reads nothing and nothing here writes.
 *
 * The screen is a history entry of its own, so the phone's Back closes it: the page keeps the open row's key in the
 * entry's state, beside whatever state the entry already had.
 */
import { formatUsdNoCents } from './jobFormatting'
import type { LienNextUpRow, LienNextUpTarget } from './lienNextUp'
import type { LienStepCard } from './lienNextUpSteps'

export type LienJobScreenDoorKey = 'paper' | 'lien_window' | 'job'

export type LienJobScreenDoor = {
  key: LienJobScreenDoorKey
  label: string
  /** A second, quieter line; empty for a door that needs none. */
  hint: string
  /** The hint is a count of missing details, drawn in red. */
  warn: boolean
}

export type LienJobScreen = {
  title: string
  /** *Notice*, *Affidavit*, *Retainage notice*. */
  kindWords: string
  /** *$8,400 open*; null when the desk knows no amount for the row. */
  owes: string | null
  /** The step card's own deadline line: *File by Nov 16 · 3 days left*. */
  due: string
  tone: LienStepCard['tone']
  /** The state the paper is in, the row's own words. */
  state: string
  doors: LienJobScreenDoor[]
  /** A run row's jobs, each a door to its job; empty for a row that is one job. */
  jobs: ReadonlyArray<{ jobId: string; title: string; dueOn: string | null }>
  /** The pinned press: the row's button, or *Open* for a row this viewer has no move on. */
  press: { label: string; primary: boolean }
  /** The row's second, quieter press (a run row's *Take back…*); null for most rows. */
  secondary: string | null
}

export type LienJobScreenCan = {
  /** The desk can open the paper as it stands (the chip's door). */
  paper: boolean
  lienWindow: boolean
  job: boolean
}

/** Whether the row's chip opens its paper: a job's notice or affidavit, never a run row or a retainage notice. The row's chip reads the same rule. */
export function lienRowHasPaper(row: Pick<LienNextUpRow, 'jobId' | 'kind' | 'jobs'>): boolean {
  return Boolean(row.jobId) && !row.jobs && row.kind !== 'retainage'
}

function paperHint(gaps: number | null): { hint: string; warn: boolean } {
  if (gaps == null) return { hint: '', warn: false }
  if (gaps > 0) return { hint: `${gaps} ${gaps === 1 ? 'detail' : 'details'} missing`, warn: true }
  return { hint: 'Nothing missing', warn: false }
}

export function lienJobScreen(
  row: LienNextUpRow,
  card: Pick<LienStepCard, 'kindWords' | 'deadline' | 'tone'>,
  opts: { amount: number | null; gaps: number | null; can: LienJobScreenCan },
): LienJobScreen {
  const doors: LienJobScreenDoor[] = []
  if (opts.can.paper && lienRowHasPaper(row)) doors.push({ key: 'paper', label: `Open the ${row.kind === 'affidavit' ? 'affidavit' : 'notice'} as it stands`, ...paperHint(opts.gaps) })
  if (opts.can.lienWindow && row.jobId) doors.push({ key: 'lien_window', label: 'Open the Lien window', hint: 'Every lien paper on this job', warn: false })
  if (opts.can.job && row.jobId) doors.push({ key: 'job', label: 'Open the job', hint: 'Its history, its bills and Edit', warn: false })
  return {
    title: row.title,
    kindWords: row.jobs ? 'Run' : card.kindWords,
    owes: opts.amount != null && opts.amount > 0 ? `${formatUsdNoCents(opts.amount)} open` : null,
    due: card.deadline,
    tone: card.tone,
    state: row.sub,
    doors,
    jobs: row.jobs ?? [],
    press: { label: row.button ?? 'Open', primary: row.button != null },
    secondary: row.secondary?.words ?? null,
  }
}

/**
 * Whether the row's press takes the desk somewhere else, so the screen should close behind it. A run and the Lien
 * window open over the desk as windows; closing one of them should leave the job's screen where it was.
 */
export function lienJobScreenClosesOnAct(target: LienNextUpTarget): boolean {
  return target.open !== 'run' && target.open !== 'lien_window'
}

type RowState = { row?: unknown }

function asRecord(state: unknown): Record<string, unknown> {
  return state != null && typeof state === 'object' && !Array.isArray(state) ? (state as Record<string, unknown>) : {}
}

/** The open row's key in a history entry's state; null when the entry names none. */
export function lienDeskRowFromState(state: unknown): string | null {
  const row = (asRecord(state) as RowState).row
  return typeof row === 'string' && row ? row : null
}

/** The entry's state with a row opened on it; whatever else the state held stays. */
export function lienDeskStateWithRow(state: unknown, key: string): Record<string, unknown> {
  return { ...asRecord(state), row: key }
}

/**
 * The state an entry keeps when the desk changes view in place. The job's screen belongs to the first view alone:
 * on any other view the row is dropped, so coming back to the first view does not open a screen nobody asked for.
 */
export function lienDeskStateForView(state: unknown, kind: string): unknown {
  if (kind === 'next' || lienDeskRowFromState(state) == null) return state
  const { row: _row, ...rest } = asRecord(state)
  return Object.keys(rest).length ? rest : null
}
