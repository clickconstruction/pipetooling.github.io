import type { LienAffidavitFields } from '../jobsDocuments/lienFilingDocuments'
import type { JobWorkMonths } from './forecastWorkMonths'
import { buildLienAffidavitFieldsForJob, type LienAffidavitJobFacts, lienAffidavitSwornMonths } from './lienNoticeDraft'
import { lienWindowLastMonth } from './lienTimelineDesk'
import type { LienWorkSpanJob } from './lienWorkSpan'
import { lienBilledOpen, type LienClaimInvoice } from './lienBilledOpen'
import { claimDeltaWords, correctedClaim, correctionSetWords, type CorrectedClaim, type LienClaimCorrection } from './lienClaimCorrection'
import { lienNothingBilledWords, lienUnbilled, lienUnbilledWords } from './lienClaimBills'
import { formatUsdNoCents } from './jobFormatting'
import type { BillTruthJob, BillTruthPayment } from '../billing/billTruth'

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

/** The months the window's affidavit swears, as keys: the same reading its fields are filled from (punch list #314, the notice check). */
export function lienWindowSwornMonths(f: Pick<LienWindowAffidavitFacts, 'job' | 'workMonths' | 'isSub' | 'todayYmd' | 'filings'>): string[] {
  const { lastMonth } = lienWindowLastMonth({ workMonths: f.workMonths, job: f.job })
  return lienAffidavitSwornMonths({ isSub: f.isSub, workDays: f.job, firstMonth: f.workMonths?.months[0]?.key ?? null, lastMonth, todayYmd: f.todayYmd, filings: f.filings })
}

export function buildLienWindowAffidavitFields(f: LienWindowAffidavitFacts): LienAffidavitFields {
  const { job, workMonths, ...facts } = f
  const { lastMonth } = lienWindowLastMonth({ workMonths, job })
  return buildLienAffidavitFieldsForJob({ ...facts, lastMonth, firstMonth: workMonths?.months[0]?.key ?? null, workDays: job })
}

/** The job as the window holds it for the claim: the row's money and status, with its bills and its payments. */
export type LienWindowClaimJob = Pick<BillTruthJob, 'id' | 'status' | 'revenue' | 'payments_made'> & {
  invoices?: ReadonlyArray<LienClaimInvoice> | null
  payments?: ReadonlyArray<Pick<BillTruthPayment, 'invoice_id' | 'amount'>> | null
}

/** The claim the window's papers carry. */
export type LienWindowClaim = {
  /** What the sent bills still owe: the desk's `open_balance`. */
  openBalance: number
  /** That, less the claim set by hand: what the notice claims and the affidavit swears. */
  claimed: CorrectedClaim
  /** The part of the job no sent bill carries: not claimed until it is billed. */
  unbilled: number
  /** How many bills have gone out, owing or paid. */
  sentBills: number
}

/**
 * The claim as the Lien window reads it for one job. Pure. The window counted the job's whole balance (price less
 * payments) and never read the claim set by hand, so it printed a different sworn amount from the desk on a job billed
 * in stages, and a correction set on the desk did not reach the printed paper. The lien money is what the sent bills
 * still owe (the owner's rule of 2026-10-08, `lienBilledOpen`, the client twin of the desk RPC's `lien_billed_open()`),
 * and a correction rides on top of it (`correctedClaim`), here as on the desk.
 */
export function lienWindowClaim(job: LienWindowClaimJob, correction: LienClaimCorrection | null | undefined): LienWindowClaim {
  const invoices = job.invoices ?? []
  const openBalance = lienBilledOpen(job, invoices, job.payments ?? [])
  return {
    openBalance,
    claimed: correctedClaim(openBalance, correction),
    unbilled: lienUnbilled(job, openBalance),
    sentBills: invoices.filter((i) => i.status === 'billed' || i.status === 'paid').length,
  }
}

/** A line under the window's claim: what it says and how loud. */
export type LienWindowClaimNote = { key: 'by_hand' | 'unbilled' | 'nothing_billed' | 'unread'; tone: 'amber' | 'red'; text: string }

/**
 * What the window says under its claim, so nobody prints a figure without knowing where it came from: a claim set by
 * hand with who set it, when and why (red when it claims more than the bills owe), the part of the job not billed yet,
 * and the plain reason when nothing is billed. `unread` is the correction read that failed: the paper would print the
 * bills' figure, and the reader is told to check the desk first.
 */
export function lienWindowClaimNotes(
  claim: LienWindowClaim,
  job: Pick<LienWindowClaimJob, 'revenue'>,
  correction: LienClaimCorrection | null | undefined,
  formatDay: (ymd: string) => string,
  opts: { correctionUnread?: boolean } = {},
): LienWindowClaimNote[] {
  const notes: LienWindowClaimNote[] = []
  if (opts.correctionUnread) notes.push({ key: 'unread', tone: 'red', text: 'Could not read whether a claim is set by hand on this job. Check the job on the Lien desk before you print.' })
  if (correction && claim.claimed.corrected) {
    const delta = claimDeltaWords(claim.claimed.delta, claim.openBalance)
    notes.push({
      key: 'by_hand',
      tone: claim.claimed.over ? 'red' : 'amber',
      text: [`Claim set by hand on the Lien desk: ${formatUsdNoCents(claim.claimed.claim)}`, delta, correction.carry ? 'carries until cleared' : 'this notice only', correctionSetWords(correction, formatDay)].filter(Boolean).join(' · '),
    })
  }
  if (claim.unbilled > 0.005) {
    notes.push(claim.openBalance > 0.005 ? { key: 'unbilled', tone: 'amber', text: `Not billed yet · ${lienUnbilledWords(claim.unbilled, job.revenue)}` } : { key: 'nothing_billed', tone: 'amber', text: lienNothingBilledWords(claim.sentBills) })
  }
  return notes
}
