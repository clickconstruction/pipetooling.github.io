/**
 * The words of the Hours statement window and its sections (punch list #212, PR 2): what the app has in the span, the
 * held line for a session still waiting for approval, the press with its count, and a saved statement's row. The signing's
 * own words are `hoursStatementSigning.ts`. Pure; the window and the sections draw these.
 */
import { pluralNoun } from '../batchWords'
import { hoursStatementLongDate, hoursStatementPeriodLabel } from './hoursStatement'
import { hoursStatementStateWords, isHoursStatementState, type HoursStatementState } from './hoursStatementRecord'

/** What the read found in the span, as the window says it. */
export type HoursStatementSpanCounts = {
  /** Sessions the paper counts: approved, clocked out, not rejected, not revoked. */
  approved: number
  /** Sessions still waiting for approval, named under their day and never counted. */
  pending: number
  /** Days with a stretch typed by hand (`clock_typed_entries`), counted among the sessions above. */
  typedDays: number
  /** Quick adds still waiting for approval: left off the paper until they are approved. */
  quickAddsLeftOff: number
  /** A sub's paper (v2.6636): the sheets in the span whose lines the paper carries; `approved` is then the lines. Missing on a clock paper. */
  sheets?: number
}

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The line under the span, and the held line when a session is still waiting:
 *  - *The app has 23 approved sessions on this job in this span. 2 days were typed by hand.*
 *  - *1 session is still waiting for approval. The paper names it under its day and does not count it.*
 */
export function hoursStatementSpanWords(c: HoursStatementSpanCounts, opts: { isOfficeJob?: boolean } = {}): { has: string; held: string | null } {
  const where = opts.isOfficeJob ? 'on the Office job' : 'on this job'
  const parts: string[] = []
  // A sub's paper reads the sheets, never the clock: *The app has 4 lines on 2 sheets for this sub on this job in this span.*
  if (c.sheets != null) {
    const has = c.sheets === 0 ? `The app has no sheet for this sub ${where} in this span.` : `The app has ${n(c.approved, 'line', 'lines')} on ${n(c.sheets, 'sheet', 'sheets')} for this sub ${where} in this span.`
    return { has, held: null }
  }
  if (c.approved === 0 && c.pending === 0) parts.push(`The app has nothing recorded ${where} in this span.`)
  else parts.push(`The app has ${n(c.approved, 'approved session', 'approved sessions')} ${where} in this span.`)
  if (c.typedDays > 0) parts.push(`${n(c.typedDays, 'day was', 'days were')} typed by hand.`)
  if (c.quickAddsLeftOff > 0) parts.push(`${n(c.quickAddsLeftOff, 'quick add is', 'quick adds are')} left off until approved.`)
  const held =
    c.pending > 0
      ? c.pending === 1
        ? '1 session is still waiting for approval. The paper names it under its day and does not count it.'
        : `${c.pending} sessions are still waiting for approval. The paper names them under their days and does not count them.`
      : null
  return { has: parts.join(' '), held }
}

/**
 * The press that opens the window, with its count (`CLAUDE.md` → Do what is ready): *Hours statement… · 3 people
 * clocked here* on a job, *Hours statement… · 4 jobs clocked* on a person's desk. At zero it reads the bare press and
 * is dead: a statement needs at least one counted session.
 */
export function hoursStatementPressWords(count: number | null, scope: 'job' | 'person', opts: { onSheets?: number } = {}): { label: string; dead: boolean } {
  if (count == null) return { label: 'Hours statement…', dead: true }
  if (count <= 0) return { label: 'Hours statement…', dead: true }
  const noun = scope === 'job' ? pluralNoun(['person', 'people'], count) : pluralNoun('job', count)
  const onSheets = opts.onSheets ?? 0
  // A sub is on the sheets, never the clock (v2.6636): *3 people here, 1 on the sheets* · *4 jobs, 2 on the sheets*.
  if (onSheets > 0) return { label: `Hours statement… · ${count} ${noun} ${scope === 'job' ? 'here' : ''}${scope === 'job' ? '' : ''}, ${onSheets} on the sheets`.replace(' ,', ','), dead: false }
  return { label: `Hours statement… · ${count} ${noun} ${scope === 'job' ? 'clocked here' : 'clocked'}`, dead: false }
}

/** What an empty section says, with the press when there is someone to make one for. */
export function hoursStatementEmptyWords(count: number | null, scope: { kind: 'job' } | { kind: 'person'; name: string }): { main: string; withPress: boolean; tail: string } {
  const who = scope.kind === 'job' ? 'on this job' : `for ${scope.name}`
  if (count != null && count <= 0) {
    return {
      main: scope.kind === 'job' ? 'Nothing is clocked on this job yet, so there is no one to make a statement for.' : `${scope.name} has no counted session on a job yet, so there is nothing to make a statement from.`,
      withPress: false,
      tail: '',
    }
  }
  return { main: `No hours statements are saved ${who} yet.`, withPress: count != null && count > 0, tail: 'makes one from the clock, the sheets and the pay reports.' }
}

/** A saved statement as the list draws it. */
export type HoursStatementListRow = {
  recordId: string
  workerName: string
  jobLabel: string
  periodStart: string
  periodEnd: string
  withPay: boolean
  /** Punch list #251: the charged paper; missing reads as paid. */
  basis?: 'paid' | 'charged' | null
  state: string
  preparedAtYmd: string
  preparedByName: string | null
}

export function hoursStatementRowWords(row: HoursStatementListRow): { record: string; period: string; state: { label: string; tone: 'grey' | 'blue' | 'amber' | 'green' }; kind: string; saved: string } {
  const state: HoursStatementState = isHoursStatementState(row.state) ? row.state : 'draft'
  const { label, tone } = hoursStatementStateWords(state)
  return {
    record: row.recordId,
    period: hoursStatementPeriodLabel(row.periodStart, row.periodEnd),
    state: { label, tone },
    kind: row.basis === 'charged' ? 'hours charged' : row.withPay ? 'hours and pay' : 'hours only',
    saved: `${hoursStatementLongDate(row.preparedAtYmd)}${row.preparedByName ? ` by ${row.preparedByName}` : ''}`,
  }
}

/** The line under the presses once a statement is saved: *Saved as HS-1042-0007 · Draft*. */
export function hoursStatementSavedWords(recordId: string, state: HoursStatementState): string {
  return `Saved as ${recordId} · ${hoursStatementStateWords(state).label}`
}
