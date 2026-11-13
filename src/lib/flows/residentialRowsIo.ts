/**
 * A residential customer's Pipeline rows, read from the client (v2.6394; out of `flowPersonIo.ts`'s v2.6232 read, so
 * Follow up's nudges read them too). `flow_rows_for` carries days and marks and never an amount, and the residential
 * loader (`residentialLoad.ts`) reads bills and payments, so the jobs, blocks, clock-ins, reports, estimates, moves,
 * bills, payments, texts and job agreements (the warranties sent in place of a contract, v2.6400) are selected here, the
 * columns `residentialRows.ts`'s `PIPELINE_SELECTS` names, for one
 * homeowner (the step card) or every homeowner at once (Follow up's nudges, as the morning run reads them); each person's
 * are cut out by `residentialRowsOf`. The two pay-day RPCs read soft: a role the gate refuses reads no pace, and the
 * bill's due day stays unset. The Pay calendars and the accepted days (punch list #323, v2.7140) read soft beside
 * them, through `payCalendarIo.ts`: with neither, a bill's due day is the pace's, as before. A table the reader may not read fails with its reason, except `job_contracts`, read soft:
 * a role that cannot read it (a tech on Job Mode) reads no Warranty rounds rather than a card that fails.
 */
import { supabase } from '../supabase'
import { formatErrorMessage } from '../../utils/errorHandling'
import { loadInvoiceAcceptances, loadPayCalendars } from '../jobs/payCalendarIo'
import { NO_PIPELINE_ROWS, PIPELINE_SELECTS, type PipelineRows } from './residentialRows'

type Answer<T> = { data: T | null; error: unknown }
const table = (name: string) => supabase.from(name as never)
const call = <T>(fn: string, args: Record<string, unknown>) => supabase.rpc(fn as never, args as never) as unknown as Promise<Answer<T>>
const NONE: Promise<Answer<never[]>> = Promise.resolve({ data: [], error: null })

function check<T>(a: Answer<T>, what: string): T {
  if (a.error) throw new Error(`${what}: ${formatErrorMessage(a.error)}`)
  return a.data as T
}

/** An RPC the reader may not be allowed, read soft: a refusal or a lost signal leaves it null, and a bill's due day unset. */
async function softCall(fn: string): Promise<unknown> {
  try {
    const a = await call<unknown>(fn, {})
    return a.error ? null : a.data
  } catch {
    return null
  }
}

/** Whose rows to read: the customers they are (`contacts.customer_id`, or the card's) and their contacts (for the ties and the texts). */
export type PipelineWho = { customerIds: readonly (string | null | undefined)[]; contactIds: readonly string[] }

/**
 * The Pipeline rows of these homeowners: the jobs they are the customer on and the ones the office tied to them
 * (`contact_jobs.jobs_ledger_id`), everything on those jobs, their own texts out, and the two RPCs the Stages tab calls.
 * Nobody named reads nothing, with no call made.
 */
export async function readPipelineRows(who: PipelineWho): Promise<PipelineRows> {
  const customerIds = [...new Set(who.customerIds.filter((id): id is string => Boolean(id)))]
  const contactIds = [...new Set(who.contactIds)]
  if (!customerIds.length && !contactIds.length) return NO_PIPELINE_ROWS
  const [jobsA, tiesA, textsA, paySpeeds, promisedPay, payCalendars, acceptedDays] = await Promise.all([
    (customerIds.length ? table('jobs_ledger').select(PIPELINE_SELECTS.jobs).in('customer_id', customerIds) : NONE) as unknown as Promise<Answer<PipelineRows['jobs'][number][]>>,
    (contactIds.length ? table('contact_jobs').select(PIPELINE_SELECTS.contactJobs).in('contact_id', contactIds).not('jobs_ledger_id', 'is', null) : NONE) as unknown as Promise<
      Answer<PipelineRows['contactJobs'][number][]>
    >,
    (contactIds.length ? table('messages').select(PIPELINE_SELECTS.texts).in('contact_id', contactIds).eq('channel', 'text').eq('direction', 'out') : NONE) as unknown as Promise<
      Answer<PipelineRows['texts'][number][]>
    >,
    softCall('get_billed_customer_pay_speeds'),
    softCall('list_job_promised_pay_dates'),
    loadPayCalendars(supabase).catch(() => null),
    loadInvoiceAcceptances(supabase).then((byInvoice) => Object.fromEntries(byInvoice), () => null),
  ])
  const own = check(jobsA, 'Their jobs') ?? []
  const contactJobs = check(tiesA, 'Their jobs') ?? []
  const tiedIds = [...new Set(contactJobs.flatMap((t) => (t.jobs_ledger_id && !own.some((j) => j.id === t.jobs_ledger_id) ? [t.jobs_ledger_id] : [])))]
  const tied = tiedIds.length ? (check((await table('jobs_ledger').select(PIPELINE_SELECTS.jobs).in('id', tiedIds)) as unknown as Answer<PipelineRows['jobs'][number][]>, 'Their jobs') ?? []) : []
  const jobs = [...own, ...tied]
  const ids = jobs.map((j) => j.id)
  const on = <T>(name: string, select: string, column: string, what: string): Promise<T[]> =>
    ids.length ? (table(name).select(select).in(column, ids) as unknown as Promise<Answer<T[]>>).then((a) => check(a, what) ?? []) : Promise.resolve([])
  const soft = <T>(name: string, select: string, column: string): Promise<T[]> =>
    ids.length ? (table(name).select(select).in(column, ids) as unknown as Promise<Answer<T[]>>).then((a) => (a.error ? [] : a.data ?? [])).catch(() => []) : Promise.resolve([])
  const [blocks, clockSessions, reports, estimates, statusEvents, invoices, payments, agreements] = await Promise.all([
    on<PipelineRows['blocks'][number]>('job_schedule_blocks', PIPELINE_SELECTS.blocks, 'job_id', 'Their visits'),
    on<PipelineRows['clockSessions'][number]>('clock_sessions', PIPELINE_SELECTS.clockSessions, 'job_ledger_id', 'Their visits'),
    on<PipelineRows['reports'][number]>('reports', PIPELINE_SELECTS.reports, 'job_ledger_id', 'Their reports'),
    on<PipelineRows['estimates'][number]>('estimates', PIPELINE_SELECTS.estimates, 'job_ledger_id', 'Their estimates'),
    on<PipelineRows['statusEvents'][number]>('job_status_events', PIPELINE_SELECTS.statusEvents, 'job_id', 'Their jobs'),
    on<PipelineRows['invoices'][number]>('jobs_ledger_invoices', PIPELINE_SELECTS.invoices, 'job_id', 'Their bills'),
    on<PipelineRows['payments'][number]>('jobs_ledger_payments', PIPELINE_SELECTS.payments, 'job_id', 'Their payments'),
    // The warranty in place of a contract (2026-11-02): the Warranty step's rounds, from the Contract Desk's rows.
    soft<NonNullable<PipelineRows['agreements']>[number]>('job_contracts', PIPELINE_SELECTS.agreements, 'job_id'),
  ])
  return { ...NO_PIPELINE_ROWS, jobs, contactJobs, blocks, clockSessions, reports, estimates, statusEvents, invoices, payments, agreements, texts: check(textsA, 'Their texts') ?? [], paySpeeds, promisedPay, payCalendars, acceptedDays }
}
