/**
 * Putting a voided lien record back (punch list #443, row 2): the take-back of **Void** on a record in a job's Lien
 * window, and of **Take it back** on *Back from the clerk*, for a dev on a test job.
 *
 * A void writes one column, the record's `voided_at`, and the record leaves the window's tabs. For a filed
 * affidavit and a § 53.056 notice the database also moves the desk paper the record had sent: back on the Lien desk,
 * or set aside when a newer paper is on the job (`lienFilingVoid.ts`). Nothing cleared a void again. This is the
 * rule for the press that does. Pure: the call is `lienFilingUnvoidIo.ts`, the list and the press
 * `components/jobs/LienVoidedRecords.tsx`.
 *
 * - The list and the press are drawn for a dev on a ZZ test job (`isZzTestJob`) and for nobody else.
 * - Every kind of record is listed once it is voided, newest void first.
 * - A record that applied a paper already on record stays voided. **Undo** was its take-back, and Undo put its own
 *   set aside notice back on the desk (v2.7508). Its press is dead, with that reason beside it.
 * - The database decides the rest: `unvoid_test_lien_filing` holds every rule again, puts back what the void did to
 *   each desk paper, and refuses in a sentence when a paper has moved on since the void or when the record was
 *   voided before a void kept its memory. Its sentence is shown as it stands.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import type { JobLienFilingRow } from './lienDeadlines'
import { lienVoidHasPaper } from './lienFilingVoid'

/** What of a job says it is a test: its names. */
export interface LienUnvoidJob {
  job_name?: string | null
  customer_name?: string | null
}

/** Who is offered the list of voided records: a dev, on a ZZ test job. Every other role and every real job sees nothing new. */
export function lienUnvoidDrawn(role: string | null | undefined, job: LienUnvoidJob | null | undefined): boolean {
  return role === 'dev' && !!job && isZzTestJob(job)
}

/** What of a record the rule and the list read. */
export type LienUnvoidRecord = Pick<JobLienFilingRow, 'id' | 'kind' | 'by_hand' | 'voided_at' | 'applied_from' | 'created_at' | 'filed_at' | 'months_covered'>

/** A job's voided records of every kind, newest void first: what the dev's list holds. */
export function lienVoidedRecords<T extends Pick<JobLienFilingRow, 'voided_at'>>(filings: ReadonlyArray<T>): T[] {
  return filings.filter((f) => !!f.voided_at).sort((a, b) => (b.voided_at ?? '').localeCompare(a.voided_at ?? ''))
}

/** The sentence for a record that applied a paper already on record. The database refuses it in the same words. */
export const LIEN_UNVOID_APPLIED = 'This record applied a paper already on record. Undo was its take-back. It stays voided.'

/** Why this record can never be put back from the list; '' when the press is live and the database decides. Null is a record that is gone. */
export function lienUnvoidProblem(record: Pick<LienUnvoidRecord, 'voided_at' | 'applied_from'> | null | undefined): string {
  if (!record) return 'The record is not there any more. Read the window again.'
  if (!record.voided_at) return 'This record is not voided.'
  if (record.applied_from) return LIEN_UNVOID_APPLIED
  return ''
}

/** What a record is, in the Lien window's own names. */
export function lienUnvoidKindWords(record: Pick<LienUnvoidRecord, 'kind' | 'by_hand' | 'applied_from'>): string {
  if (record.kind === 'notice_53_056') return record.applied_from ? '§ 53.056 notice, applied from a paper on record' : record.by_hand ? '§ 53.056 notice, recorded by hand' : '§ 53.056 notice'
  if (record.kind === 'retainage_53_057') return '§ 53.057 retainage notice'
  if (record.kind === 'affidavit') return 'Lien affidavit'
  if (record.kind === 'release_of_record') return 'Release of record'
  return 'Lien record'
}

const dayOfInstant = (iso: string | null | undefined): string => {
  const ymd = iso && Number.isFinite(Date.parse(iso)) ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : ''
}

const dayOfDate = (ymd: string | null | undefined): string => (ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? formatWorkDateYmdWeekdayShortFriendly(ymd.slice(0, 10)) : '')

/** One fact of a record: its label, and its value drawn apart from the label. */
export interface LienUnvoidFact {
  label: string
  value: string
}

/**
 * A record's facts, one a line, as the list draws them: what it is, the months a notice covers, the day the clerk
 * filed an affidavit, the day it was recorded and the day it was voided. A fact with no value is left out.
 */
export function lienUnvoidFacts(record: LienUnvoidRecord): LienUnvoidFact[] {
  const months = record.kind === 'notice_53_056' ? (record.months_covered ?? []).join(', ') : ''
  const facts: LienUnvoidFact[] = [
    { label: 'Record', value: lienUnvoidKindWords(record) },
    { label: 'Covers', value: months },
    { label: 'Filed', value: record.kind === 'affidavit' ? dayOfDate(record.filed_at) : '' },
    { label: 'Recorded', value: dayOfInstant(record.created_at) },
    { label: 'Voided', value: dayOfInstant(record.voided_at) },
  ]
  return facts.filter((f) => f.value !== '')
}

/** The list's heading and the line under it. */
export const LIEN_UNVOID_WORDS = {
  heading: 'Voided records',
  lede: 'Only a developer sees this list, and only on a test job. Put back makes a voided record live again.',
  press: 'Put back…',
  busy: 'Putting back…',
  notDone: 'The record was not put back.',
  noAnswer: 'The record was not put back. The database gave no answer.',
} as const

/**
 * The confirm window's words: what comes back. A filed affidavit and a § 53.056 notice are the two records whose
 * void moves a desk paper, so only they say what becomes of one. The button names the act.
 */
export function lienUnvoidConfirm(record: Pick<LienUnvoidRecord, 'kind'>): { title: string; message: string; confirmLabel: string } {
  const paper = lienVoidHasPaper(record.kind) ? ' A paper its void put back on the Lien desk goes to sent again, tied to this record. A paper its void set aside stands again.' : ''
  return {
    title: 'Put this record back?',
    message: `The record stands live on this job again.${paper}`,
    confirmLabel: 'Put the record back',
  }
}

/** What the database did to the record's desk papers: how many it sent again, and how many it took out of set aside. */
export interface LienUnvoidAnswer {
  restored: number
  unsetAside: number
}

const count = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/** What `unvoid_test_lien_filing` answered, when it answered `{ ok: true, … }` with its two counts; null for anything else. */
export function lienUnvoidAnswer(answer: unknown): LienUnvoidAnswer | null {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return null
  const a = answer as Record<string, unknown>
  if (a.ok !== true) return null
  const restored = count(a.papers_restored)
  const unsetAside = count(a.papers_unset_aside)
  return restored == null || unsetAside == null ? null : { restored, unsetAside }
}

/** What the toast says once the record is back, from the counts the database answered. */
export function lienUnvoidDoneWords(answer: LienUnvoidAnswer): string {
  const sent = answer.restored === 1 ? 'Its paper on the Lien desk is sent again, tied to it.' : answer.restored > 1 ? `Its ${answer.restored} papers on the Lien desk are sent again, tied to it.` : ''
  const aside = answer.unsetAside === 1 ? 'The paper its void set aside stands again.' : answer.unsetAside > 1 ? `The ${answer.unsetAside} papers its void set aside stand again.` : ''
  return ['The record is back.', sent, aside].filter(Boolean).join(' ')
}
