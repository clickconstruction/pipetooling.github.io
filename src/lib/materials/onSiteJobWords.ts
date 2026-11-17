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

/** The head of a job's page: `press` opens the job window, `rest` is read beside it, `openLabel` is what the press is called. */
export type OnSiteJobHead = { press: string; rest: string; openLabel: string }

/**
 * A job's page is headed by its number and its name, and the number is the press that opens the job (the owner's ask
 * of 2026-11-17, in place of a button at the far end of the line). A job with no number is opened by its name, and a
 * job the page could not name by the words it has for it (`fallback`), so the head always holds one press.
 */
export function onSiteJobHead(job: OnSiteJobNamed | null | undefined, fallback: string): OnSiteJobHead {
  if (!job) return { press: fallback, rest: '', openLabel: `Open ${fallback}` }
  const number = onSiteJobNumber(job)
  const name = (job.job_name ?? '').trim() || (job.customer_name ?? '').trim()
  if (number) return { press: number, rest: name || '—', openLabel: `Open job ${number}` }
  return { press: name || '—', rest: '', openLabel: name ? `Open the job ${name}` : 'Open the job' }
}

/** `224 · Phase 2 draws`. A dash stands for a half the job does not have; the customer's name stands in for a missing job name. */
export function onSiteJobWords(job: OnSiteJobNamed): string {
  return `${onSiteJobNumber(job) || '—'} · ${(job.job_name ?? '').trim() || (job.customer_name ?? '').trim() || '—'}`
}
