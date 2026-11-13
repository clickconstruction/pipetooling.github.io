/**
 * The Lien desk's Deadlines rows (pure): every billed job with the runway its Pipeline row carries,
 * as `LienCalendarJob` rows for the Deadlines grid (v2.4101, punch list #55). Until punch list #182
 * moved the desk to `/lien-desk` this lived inline in `JobsStagesTab` (`lienRunwayFor` and the
 * `lienCalendarRows` memo); the Pipeline and the page build the same rows through this one kernel,
 * so the grid cannot drift between the two.
 */
import type { Database } from '../../types/database'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { BilledLienClock, BilledLienClockJob } from '../../hooks/useBilledLienClocks'
import type { LienCalendarJob } from './lienCalendar'
import { buildLienPayRunway, type LienPayRunway } from './lienPayRunway'
import { lienBilledOpen } from './lienBilledOpen'
import type { PaySpeedData, PromisedPayDate } from './billedExpectedPay'
import { billedPayModel } from './billedDuePay'
import { calendarFor, type PayCalendarIndex } from './payCalendar'
import { paceInputFor, sentFromHereOf, type PaceContext } from './payPace'
import { listPayer, paySpeedPayer } from './billToParty'
import { effectiveInvoiceEstBillDate, stageRowBilledRemainingAmount } from './invoiceBilling'
import { jobUncollectible, type StageRow } from '../jobsStagesBoard'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

/** What a job's runway is read against: the lien clocks, the payer paces, the promised dates and the pace rule's context. */
export type LienRunwayDeps = {
  clocks: Record<string, BilledLienClock> | null
  paySpeeds: PaySpeedData | null
  promisedPayDates: Record<string, PromisedPayDate> | null
  paceContext: PaceContext | null
  todayYmd: string
  /** The stored Pay calendars (punch list #323): a payer on one is expected on its due day plus its usual lateness. Absent or null, the pace guess as before. */
  payCalendars?: PayCalendarIndex | null
  /** The day a payer accepted each bill that has one (PR 4), by the bill's id: a calendar counts its cutoff from it. */
  acceptedByInvoice?: ReadonlyMap<string, string> | null
}

/** The billed jobs whose lien clocks are read: a job marked Uncollectible is off the desk — no clock, no row (v2.4788, punch list #94). */
export function billedLienClockJobsOf(jobs: ReadonlyArray<JobWithDetails>): BilledLienClockJob[] {
  return jobs.filter((j) => j.status === 'billed' && !jobUncollectible(j)).map((j) => ({ id: j.id, customer_address_id: j.customer_address_id ?? null, gc_customer_id: j.gc_customer_id ?? null }))
}

/** The payers the pace rule reads across the board's Billed and Collections rows: whoever owes each open bill. */
export function paceContextPayerIds(rows: ReadonlyArray<StageRow>): Array<string | null> {
  const payerIds: Array<string | null> = []
  for (const r of rows) {
    if (r.kind === 'job' || !(stageRowBilledRemainingAmount(r) > 0)) continue
    payerIds.push(listPayer(r.job, r.inv).id)
  }
  return payerIds
}

/** A job's lien runway, read against its clock and its bill's expected-pay model; null until the clock is read. */
export function lienRunwayForJob(job: JobWithDetails, inv: JobsLedgerInvoice | null, deps: LienRunwayDeps): LienPayRunway | null {
  const clock = deps.clocks?.[job.id]
  if (!clock) return null
  // v2.4365: the bill's payer's pace (the GC on a GC-billed bill), the history pay_speed_samples keys on.
  const payer = inv ? paySpeedPayer(job, inv) : null
  const model =
    inv && payer
      ? billedPayModel(
          { billedAtIso: inv.billed_at, estBillYmd: effectiveInvoiceEstBillDate(inv), customerId: payer.id, payerName: payer.name, acceptedYmd: deps.acceptedByInvoice?.get(inv.id) ?? null },
          deps.paySpeeds,
          deps.todayYmd,
          deps.promisedPayDates?.[job.id] ?? null,
          paceInputFor(deps.paceContext, { payerId: payer.id, jobId: job.id, sentFromHere: sentFromHereOf(inv) }, deps.paySpeeds),
          calendarFor(deps.payCalendars, { payerId: payer.id, jobId: job.id }),
        )
      : null
  return buildLienPayRunway({
    todayYmd: deps.todayYmd,
    // What the sent bills owe (v2.4970), as the desk counts it — never the job's whole balance.
    openBalance: lienBilledOpen(job, job.invoices ?? [], job.payments ?? []),
    lastWorkYmd: job.last_work_date ?? null,
    // The last day of work set by hand (v2.4676) counts first, as on the desk (v2.4830).
    handLastWorkYmd: job.lien_last_work_on ?? null,
    createdAt: job.created_at ?? null,
    propertyKind: clock.propertyKind,
    expectedPayYmd: model?.expectedYmd ?? null,
    filedYmd: clock.filedYmd,
    // v2.7047: whether the filed affidavit's copy is served, and by when it has to be.
    servedYmd: clock.servedYmd ?? null,
    serveDueYmd: clock.serveDueYmd ?? null,
    releasedYmd: clock.releasedYmd,
    isSub: Boolean(job.gc_customer_id),
    noticedMonths: clock.noticedMonths,
    anyNoticeOnFile: clock.noticeOnFile,
    // v2.5522: the months printed and in the mail draw the In the mail mark instead of a hollow flag.
    mailedMonths: clock.mailedMonths,
    workMonths: clock.workMonths,
  })
}

/**
 * The Deadlines rows: every billed job (never one given up on) whose runway says something, with the
 * one billed bill handed to the runway when the job has exactly one. The caller says when the rows are
 * ready (the billed scope merged, the clocks read); this only shapes them.
 */
export function buildLienCalendarRows(jobs: ReadonlyArray<JobWithDetails>, runwayFor: (job: JobWithDetails, inv: JobsLedgerInvoice | null) => LienPayRunway | null): LienCalendarJob[] {
  const out: LienCalendarJob[] = []
  for (const job of jobs) {
    if (job.status !== 'billed') continue
    if (jobUncollectible(job)) continue // v2.4788: given up on — off the calendar and the Deadlines list
    const billed = (job.invoices ?? []).filter((i) => i.status === 'billed')
    const runway = runwayFor(job, billed.length === 1 ? billed[0]! : null)
    if (!runway || runway.state === 'none') continue
    out.push({
      jobId: job.id,
      number: effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—',
      name: (job.job_name ?? '').trim() || 'Job',
      customer: (job.customer_name ?? '').trim(),
      gcId: job.gc_customer_id ?? null,
      gcName: job.gcCustomer?.name?.trim() || null,
      address: (job.job_address ?? '').trim(),
      openBalance: Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0)),
      isSub: Boolean(job.gc_customer_id),
      runway,
      lastWorkYmd: job.lien_last_work_on || job.last_work_date || null,
      addressId: job.customer_address_id ?? null,
    })
  }
  return out
}
