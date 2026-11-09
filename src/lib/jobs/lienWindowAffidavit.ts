import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import type { JobWorkMonths } from './forecastWorkMonths'
import { buildLienAffidavitFieldsForJob, type LienAffidavitJobFacts } from './lienNoticeDraft'
import { lienWindowLastMonth } from './lienTimelineDesk'
import type { LienWorkSpanJob } from './lienWorkSpan'

/**
 * The § 53.054 affidavit as the job's Lien window fills it (v2.6809). Pure. The window's Mechanic's lien tab is
 * where the office prints the paper, and it filled the fields by hand beside the desk's recipe: the period read
 * the session months alone, so a job with no clock hours printed *from — through —* where the desk's draft
 * swore its month, and the original contractor's address was never handed over. Now the window gives what it
 * knows (the job row, the forecast's months, the GC's row) and the desk's own recipe
 * (`buildLienAffidavitFieldsForJob`) fills the paper, so the two draws cannot drift again. The last month is the
 * window strip's own (`lienWindowLastMonth`): the creation month when the job has no hours and no day set by hand.
 */
export type LienWindowAffidavitFacts = Omit<LienAffidavitJobFacts, 'lastMonth' | 'firstMonth' | 'workDays'> & {
  /** The job row: its creation day and its work days (the fresh last-day read laid over it, when the window has one). */
  job: LienWorkSpanJob & { created_at?: string | null }
  /** The forecast's months for the job (sessions by month); null for a job with no sessions, or before they are read. */
  workMonths: Pick<JobWorkMonths, 'months' | 'lastMonthKey'> | null | undefined
}

export function buildLienWindowAffidavitFields(f: LienWindowAffidavitFacts): LienAffidavitFields {
  const { job, workMonths, ...facts } = f
  const { lastMonth } = lienWindowLastMonth({ workMonths, job })
  return buildLienAffidavitFieldsForJob({ ...facts, lastMonth, firstMonth: workMonths?.months[0]?.key ?? null, workDays: job })
}
