/**
 * Deleting a by-hand notice record (punch list #443, row 1): the take-back of **Record it…** and the by-hand form
 * on a § 53.056 notice, for the record and its line on the job's Activity.
 *
 * A notice recorded by hand is one `job_lien_filings` row with `by_hand` set. **Void** takes it off the job's tabs
 * and keeps the row, so a test record stood in the table for good. This is the rule for the press that deletes
 * one. Pure: the reads and the delete are `lienByHandRecordDeleteIo.ts`, the list and the press
 * `components/jobs/LienVoidedByHandRecords.tsx`.
 *
 * - The list and the press are drawn for a dev and for nobody else.
 * - Only a § 53.056 notice recorded by hand goes. A notice the run made, an affidavit, a retainage notice and a
 *   release of record are never offered.
 * - Only a voided record goes. The void is what puts a tied desk paper back, so a live record is voided first.
 * - Only a record on a ZZ test job goes (`isZzTestJob`: the job's name or its customer's starts with ZZ).
 * - A record anything points at stays, and the line says what: a paper on the Lien desk or a bill's pay offer
 *   (the database would clear either pointer silently), another record applied from it (the database would refuse
 *   the delete), or a sent copy that names it.
 *
 * **The line on the job's Activity goes with the record.** The record's insert wrote the line, and a signed-in
 * person can only read that table, so the delete is a function's: `delete_test_lien_notice_record` holds every rule
 * above again and takes the record and its line in one transaction. The rule here runs first, in the same words.
 *
 * **Activity lines of deleted notice records.** Until that function, the delete took the record alone and left its
 * line. A line whose record is gone is a stray. The second half of this file is the rule for the press that clears
 * a test job's strays, and `delete_test_lien_notice_stray_lines` decides again which lines those are.
 */
import { isZzTestJob } from '../../../supabase/functions/_shared/zzTestJob'
import { countedLabel } from '../batchWords'
import { calendarYmdInAppTzFromIso, formatWorkDateYmdWeekdayShortFriendly } from '../../utils/dateUtils'
import type { JobLienFilingRow } from './lienDeadlines'

/** The kind of a § 53.056 notice. */
export const LIEN_BY_HAND_NOTICE_KIND = 'notice_53_056'

/** Who is offered the list of voided by-hand records: a dev. Every other role sees nothing new. */
export function lienByHandDeleteDrawn(role: string | null | undefined): boolean {
  return role === 'dev'
}

/** What of a record the rule reads. */
export type LienByHandRecord = Pick<JobLienFilingRow, 'id' | 'job_id' | 'kind' | 'by_hand' | 'voided_at' | 'packet_id'>

/** What of a job says it is a test: its names. */
export interface LienByHandJob {
  job_name?: string | null
  customer_name?: string | null
}

/** Why this record can never be deleted, whatever points at it; '' when it may be, once its ties are read. Null is a record that is gone. */
export function lienByHandDeleteProblem(record: LienByHandRecord | null | undefined, job: LienByHandJob | null | undefined): string {
  if (!record) return 'The record is not there any more. Read the window again.'
  if (record.kind !== LIEN_BY_HAND_NOTICE_KIND || !record.by_hand) return 'Only a notice recorded by hand can be deleted.'
  if (!record.voided_at) return 'Void this record first.'
  if (!job || !isZzTestJob(job)) return 'Only a record on a test job can be deleted. This job is a real one.'
  return ''
}

/** How many rows point at a record, by what they are. */
export interface LienRecordTies {
  /** Papers on the Lien desk tied to it as the record of their send. */
  deskPapers: number
  /** Bills whose pay offer names it. */
  bills: number
  /** Other records applied from it. */
  appliedFrom: number
  /** Sent copies that name it as their source. */
  sentCopies: number
}

const some = (n: number, one: string, many: string): string => (n === 1 ? one : many.replace('{n}', String(n)))

/** Why a record stays because something points at it; '' when nothing does. Null is ties that could not be read. */
export function lienByHandTiesProblem(ties: LienRecordTies | null | undefined): string {
  if (!ties || [ties.deskPapers, ties.bills, ties.appliedFrom, ties.sentCopies].some((n) => !Number.isFinite(n) || n < 0)) return 'What points at this record could not be read. Nothing was deleted.'
  if (ties.deskPapers > 0) return `${some(ties.deskPapers, 'A paper on the Lien desk is', '{n} papers on the Lien desk are')} tied to this record. It stays.`
  if (ties.bills > 0) return `${some(ties.bills, 'A bill’s pay offer names', 'The pay offers of {n} bills name')} this record. It stays.`
  if (ties.appliedFrom > 0) return `${some(ties.appliedFrom, 'Another record was', '{n} other records were')} applied from this one. It stays.`
  if (ties.sentCopies > 0) return `${some(ties.sentCopies, 'A sent copy names', '{n} sent copies name')} this record. It stays.`
  return ''
}

/** The voided by-hand notice records among a job's filings, newest voided first: what the dev's list holds. */
export function lienVoidedByHandRecords<T extends Pick<JobLienFilingRow, 'kind' | 'by_hand' | 'voided_at'>>(filings: ReadonlyArray<T>): T[] {
  return filings.filter((f) => f.kind === LIEN_BY_HAND_NOTICE_KIND && f.by_hand && !!f.voided_at).sort((a, b) => (b.voided_at ?? '').localeCompare(a.voided_at ?? ''))
}

const dayWords = (iso: string | null | undefined): string => {
  const ymd = iso && Number.isFinite(Date.parse(iso)) ? calendarYmdInAppTzFromIso(iso) : ''
  return ymd ? formatWorkDateYmdWeekdayShortFriendly(ymd) : ''
}

/** One record's line in the list: *Covers 2026-08. Recorded Mon, Nov 23. Voided Tue, Nov 24.* */
export function lienByHandRecordWords(record: Pick<JobLienFilingRow, 'months_covered' | 'created_at' | 'voided_at'>): string {
  const months = (record.months_covered ?? []).join(', ')
  const made = dayWords(record.created_at)
  const voided = dayWords(record.voided_at)
  return [months ? `Covers ${months}.` : '', made ? `Recorded ${made}.` : '', voided ? `Voided ${voided}.` : ''].filter(Boolean).join(' ')
}

/**
 * The confirm window's words. `siblings` is how many other records the same paper wrote, on other jobs: one by-hand
 * press writes a record for each job the paper covered, and this deletes the one on this job alone. The button names the act.
 */
export function lienByHandDeleteConfirm(siblings: number): { title: string; message: string; confirmLabel: string } {
  const others = siblings > 0 ? ` ${some(siblings, '1 other record of the same paper, on another job, stays.', '{n} other records of the same paper, on other jobs, stay.')}` : ''
  return {
    title: 'Delete this notice record?',
    message: `1 record is deleted, for good. Its line on the job’s Activity goes with it.${others}`,
    confirmLabel: 'Delete the record',
  }
}

/** What the toast says once it is gone. */
export const LIEN_BY_HAND_RECORD_DELETED = 'The record was deleted. Its line on the job’s Activity went with it.'

/** The type of the Activity line a notice record's insert writes (`job_lien_filings_to_activity_ins`). */
export const LIEN_NOTICE_ACTIVITY_EVENT = 'lien_notice_sent'

/** What of an Activity line the stray rule reads: its id, and its detail, which names its record as `source_id`. */
export interface LienNoticeActivityLine {
  id: string
  detail: unknown
}

/** The id of the record a line names, '' when it names none. */
export function lienNoticeLineRecordId(line: Pick<LienNoticeActivityLine, 'detail'>): string {
  const detail = line.detail
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return ''
  const id = (detail as Record<string, unknown>).source_id
  return typeof id === 'string' ? id.trim() : ''
}

/**
 * The stray lines among a job's notice lines: each names a record that is not among the job's records, voided ones
 * counted. A line that names no record is left alone, as the function leaves it. This is the window's count. The
 * function looks for the record on every job, so it may clear fewer, and the toast says what it cleared.
 */
export function lienNoticeStrayLines<T extends LienNoticeActivityLine>(lines: ReadonlyArray<T>, filings: ReadonlyArray<Pick<JobLienFilingRow, 'id'>>): T[] {
  const standing = new Set(filings.map((f) => f.id.toLowerCase()))
  return lines.filter((line) => {
    const id = lienNoticeLineRecordId(line).toLowerCase()
    return id !== '' && !standing.has(id)
  })
}

/** Who is offered the stray lines: a dev, on a ZZ test job. A real job's Activity is never cleared. */
export function lienNoticeStrayLinesDrawn(role: string | null | undefined, job: LienByHandJob | null | undefined): boolean {
  return lienByHandDeleteDrawn(role) && !!job && isZzTestJob(job)
}

/** The confirm window's words for **Clear…**. The button names the act with its count. */
export function lienNoticeStrayClearConfirm(n: number): { title: string; message: string; confirmLabel: string } {
  const one = n === 1
  return {
    title: one ? 'Clear this Activity line?' : `Clear these ${n} Activity lines?`,
    message: `${one ? '1 line is' : `${n} lines are`} deleted from the job’s Activity, for good. ${one ? 'It names' : 'Each names'} a notice record that was deleted. Every other line stays.`,
    confirmLabel: countedLabel('Clear', n, 'line'),
  }
}

/** What the toast says once the function answered, from the count it cleared. Zero is an answer. */
export function lienNoticeStrayClearedWords(cleared: number): string {
  if (!(cleared > 0)) return 'No Activity line was cleared. The database found no line whose record is gone.'
  return cleared === 1 ? '1 Activity line was cleared.' : `${cleared} Activity lines were cleared.`
}
