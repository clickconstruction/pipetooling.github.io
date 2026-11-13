/**
 * A residential customer's Pipeline rows, read beside `flow_rows` (v2.6232). `flow_rows_for` carries days and marks and
 * never an amount, and the residential loader (`residentialLoad.ts`'s `residentialStampsFor`) reads bills and payments,
 * so the step card (`flowPersonIo.ts`) and the morning run (`messages-nudge-dispatch` → `nudgeRunInputs.ts`) select
 * these tables themselves, as they already do for a candidate's board row and a sub's sheets, and both come through
 * here: `PIPELINE_SELECTS` names the columns each selects, and `residentialRowsOf` cuts one customer's `ResidentialRows`
 * out of what was read, whether that was theirs alone or everyone's at once. Pure.
 */
import { parsePaySpeedsRpc, parsePromisedPayDatesRpc } from '../jobs/billedExpectedPay'
import { indexPayCalendars, type PayCalendarRow } from '../jobs/payCalendar'
import type { ContactRow, StepSkipRow } from './load'
import type {
  ClockSessionRow,
  EstimateRow,
  FieldReportRow,
  JobAgreementRow,
  JobStatusEventRow,
  PipelineContactJobRow,
  PipelineInvoiceRow,
  PipelineJobRow,
  PipelineMessageRow,
  PipelinePaymentRow,
  ResidentialRows,
  ScheduleBlockRow,
} from './residentialLoad'

/** The columns each read selects, the loader's row types and no more (`job_name` names the job for `{job}`). */
export const PIPELINE_SELECTS = {
  jobs: 'id, created_at, status, revenue, customer_id, gc_customer_id, bill_to_party, customer_name, job_name',
  contactJobs: 'contact_id, jobs_ledger_id, is_default',
  blocks: 'job_id, work_date, created_at, created_by',
  clockSessions: 'job_ledger_id, user_id, clocked_in_at, revoked_at, rejected_at',
  reports: 'job_ledger_id, created_by_user_id, created_at, field_values',
  estimates: 'job_ledger_id, doc_kind, status, sent_at, acceptor_consented_at',
  statusEvents: 'job_id, to_status, changed_at, changed_by_user_id',
  invoices: 'id, job_id, status, amount, sequence_order, billed_at, sent_to_customer_at, estimated_bill_date, created_at, sent_by_user_id, bill_to_party, bill_to_email',
  payments: 'job_id, invoice_id, amount, paid_on, sequence_order',
  texts: 'contact_id, jobs_ledger_id, channel, direction, at, body, who_user_id, who_text',
  /** `job_contracts`: the warranties sent in place of a contract (the Warranty step's rounds); every kind is read, the loader keeps the warranties. */
  agreements: 'id, job_id, kind, status, sent_at, signed_at, voided_at',
  /** `payer_pay_calendars` (punch list #323, v2.7140), for `parsePayCalendarRow`: the morning run selects them; the client reads through `payCalendarIo.ts`. */
  payCalendars: 'payer_customer_id, job_id, off, cutoff_day, pay_day, months_after, pay_when_paid, clause, words, set_at',
  /** `invoice_payer_acceptances`: the day a payer accepted a bill, which its Pay calendar counts from. */
  acceptedDays: 'invoice_id, accepted_on',
} as const

/** `jobs_ledger`, with the job's name for the card and `{job}`. */
export type PipelineNamedJobRow = PipelineJobRow & { job_name?: string | null }

/**
 * What was read of the Pipeline tables, one customer's or everyone's: each job list keyed by `job_id`, the ties and the
 * texts by `contact_id`. The two RPCs come as they answered (`get_billed_customer_pay_speeds`,
 * `list_job_promised_pay_dates`), or already parsed; null when a read failed, which leaves a bill's due day unset.
 */
export type PipelineRows = {
  jobs: readonly PipelineNamedJobRow[]
  contactJobs: readonly (PipelineContactJobRow & { contact_id: string })[]
  blocks: readonly ScheduleBlockRow[]
  clockSessions: readonly ClockSessionRow[]
  reports: readonly FieldReportRow[]
  estimates: readonly EstimateRow[]
  statusEvents: readonly JobStatusEventRow[]
  invoices: readonly PipelineInvoiceRow[]
  payments: readonly PipelinePaymentRow[]
  texts: readonly (PipelineMessageRow & { contact_id: string })[]
  /** Left out by a reader from before the warranty: no round, as before. */
  agreements?: readonly JobAgreementRow[]
  paySpeeds: unknown
  promisedPay: unknown
  /** The stored Pay calendars, parsed (`parsePayCalendarRow`). Left out or null by a reader from before v2.7140, or when the read failed: every bill then reads the pay speeds. */
  payCalendars?: readonly PayCalendarRow[] | null
  /** The day a payer accepted each bill that has one (`YYYY-MM-DD`), by the bill's id. Left out or null: every bill counts from the day it went in. */
  acceptedDays?: Readonly<Record<string, string>> | null
}

/** An empty read, for a run with no residential customer. */
export const NO_PIPELINE_ROWS: PipelineRows = { jobs: [], contactJobs: [], blocks: [], clockSessions: [], reports: [], estimates: [], statusEvents: [], invoices: [], payments: [], texts: [], agreements: [], paySpeeds: null, promisedPay: null }

/** Whose rows to cut out: the contact, what our texts call them, their customer record, and what `flow_rows` gave. */
export type ResidentialWho = {
  contact: ContactRow
  /** Their first name, as our texts greet them ("Dana"), which the On our way rule reads. */
  firstName: string
  /** `contacts.customer_id`, or the card's; null leaves them with the jobs the office tied to them alone. */
  customerId: string | null
  userNames?: Readonly<Record<string, string>>
  /** `flow_rows`' skips, which already name a Pipeline job in `jobs_ledger_id`. */
  skips?: readonly StepSkipRow[]
}

/**
 * One residential customer's rows out of what was read: the jobs they are the customer on and the ones the office tied
 * to them (`contact_jobs.jobs_ledger_id`), everything on those jobs, their own texts, and the two RPCs parsed. Every
 * list the loader reads is theirs alone, so another customer's payment never pays their bill.
 */
export function residentialRowsOf(rows: PipelineRows, who: ResidentialWho): ResidentialRows {
  const contactJobs = rows.contactJobs.filter((j) => j.contact_id === who.contact.id)
  const ids = new Set<string>()
  for (const j of rows.jobs) if (who.customerId && j.customer_id === who.customerId) ids.add(j.id)
  for (const j of contactJobs) if (j.jobs_ledger_id) ids.add(j.jobs_ledger_id)
  const on = (jobId: string | null | undefined) => jobId != null && ids.has(jobId)
  return {
    contact: who.contact,
    firstName: who.firstName,
    jobs: rows.jobs.filter((j) => ids.has(j.id)),
    contactJobs: contactJobs.map((j) => ({ jobs_ledger_id: j.jobs_ledger_id, is_default: j.is_default })),
    userNames: who.userNames,
    blocks: rows.blocks.filter((b) => on(b.job_id)),
    clockSessions: rows.clockSessions.filter((c) => on(c.job_ledger_id)),
    reports: rows.reports.filter((r) => on(r.job_ledger_id)),
    estimates: rows.estimates.filter((e) => on(e.job_ledger_id)),
    statusEvents: rows.statusEvents.filter((e) => on(e.job_id)),
    invoices: rows.invoices.filter((i) => on(i.job_id)),
    payments: rows.payments.filter((p) => on(p.job_id)),
    messages: rows.texts.filter((m) => m.contact_id === who.contact.id),
    agreements: (rows.agreements ?? []).filter((a) => on(a.job_id)),
    skips: (who.skips ?? []).map((k) => ({ step_key: k.step_key, jobs_ledger_id: k.jobs_ledger_id ?? null, why: k.why, by_name: k.by_name, created_at: k.created_at, undone_at: k.undone_at })),
    paySpeeds: parsePaySpeedsRpc(rows.paySpeeds),
    promisedPay: parsePromisedPayDatesRpc(rows.promisedPay) ?? undefined,
    payCalendars: rows.payCalendars?.length ? indexPayCalendars(rows.payCalendars) : null,
    acceptedByInvoice: acceptedOf(rows),
  }
}

/** The accepted days as the loader reads them, by the bill's id; null when none was read. */
function acceptedOf(rows: Pick<PipelineRows, 'acceptedDays'>): ReadonlyMap<string, string> | null {
  const days = rows.acceptedDays
  if (!days) return null
  const out = new Map<string, string>()
  for (const [invoiceId, ymd] of Object.entries(days)) if (typeof ymd === 'string' && ymd) out.set(invoiceId, ymd.slice(0, 10))
  return out.size ? out : null
}

/** The name the card and `{job}` give each of their Pipeline jobs, by id, for `PersonFlow.jobs`. */
export function pipelineJobNames(jobs: readonly PipelineNamedJobRow[]): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {}
  for (const j of jobs) if (j.job_name?.trim()) out[j.id] = j.job_name.trim()
  return out
}
