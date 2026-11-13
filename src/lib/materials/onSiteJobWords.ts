/**
 * How the Materials on site screens name a job (punch list #209): its number, a dot, its name.
 *
 * The number is the app's own rule (`effectiveJobLedgerNumber`): the HCP number when the job has one, else the
 * number the app gave it. Until v2.7162 these screens read the HCP number alone, so every job made in the app,
 * which is every job that holds a box today, read as a dash on the desk, the phone's job press, and the printed
 * labels and manifests.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

export type OnSiteJobNamed = { hcp_number?: string | null; click_number?: string | null; job_name?: string | null; customer_name?: string | null }

/** The job's number as printed here, '' when it has none. */
export function onSiteJobNumber(job: Pick<OnSiteJobNamed, 'hcp_number' | 'click_number'> | null | undefined): string {
  return effectiveJobLedgerNumber(job?.hcp_number, job?.click_number)
}

/** `224 · Phase 2 draws`. A dash stands for a half the job does not have; the customer's name stands in for a missing job name. */
export function onSiteJobWords(job: OnSiteJobNamed): string {
  return `${onSiteJobNumber(job) || '—'} · ${(job.job_name ?? '').trim() || (job.customer_name ?? '').trim() || '—'}`
}
