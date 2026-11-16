/**
 * The morning run's read of the pay terms (`messages-nudge-dispatch`; punch list #323, v2.7140, and #341, v2.7452):
 * the Pay calendars with their days after the bill, each of these bills' own due day, and the day a payer accepted a
 * bill, the columns `PIPELINE_SELECTS` names and the rows a screen is handed through `payCalendarIo.ts`. So a Paid
 * round is due on the day the Pipeline's billed row shows.
 *
 * Soft, each alone: a read that fails says why through `warn` and leaves that half null. A bill's own day stands
 * without the calendars and the calendars without the days; with neither the kernel reads the pace for a bill's due
 * day, as it did before, and the morning goes on. Its own file, with no URL import, so vitest runs the function's
 * read as it stands (`src/lib/flows/morningRunPayTerms.test.ts`).
 */
// deno-lint-ignore-file no-explicit-any
import { PIPELINE_SELECTS, payTermRowsOf, type PipelineRows } from './gcKernels/lib/flows/residentialRows.ts'
import type { BillDueDayDbRow, PayCalendarDbRow } from './gcKernels/lib/jobs/payCalendar.ts'

/** PostgREST's page, and how many ids one read takes. */
const PAGE = 1000
const CHUNK = 100

type Answer<T> = { data: T[] | null; error: { message: string } | null }

/** Every row of a read, page by page; the read orders itself so the pages do not overlap. */
async function all<T>(read: (from: number, to: number) => PromiseLike<Answer<T>>, what: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await read(from, from + PAGE - 1)
    if (error) throw new Error(`${what}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) return out
  }
}

const chunks = <T>(xs: readonly T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/** A read that may fail: null then, with why said through `warn`. */
async function soft<T>(read: () => Promise<T>, warn: (message: string) => void): Promise<T | null> {
  try {
    return await read()
  } catch (e) {
    warn(e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * The pay terms of these bills, as `PipelineRows` carries them. `invoiceIds` are the bills the morning read; a
 * bill's own day and its accepted day are read for those alone, the calendars whole.
 */
export async function readPayTerms(admin: any, invoiceIds: readonly string[], warn: (message: string) => void): Promise<Pick<PipelineRows, 'payCalendars' | 'acceptedDays'>> {
  const [calendars, dueDays] = await Promise.all([
    soft(() => all<PayCalendarDbRow>((a, b) => admin.from('payer_pay_calendars').select(PIPELINE_SELECTS.payCalendars).order('payer_customer_id').order('job_id').range(a, b), 'payer_pay_calendars'), warn),
    invoiceIds.length
      ? soft(async () => {
          const rows: BillDueDayDbRow[] = []
          for (const ids of chunks(invoiceIds, CHUNK)) rows.push(...(await all<BillDueDayDbRow>((a, b) => admin.from('invoice_due_days').select(PIPELINE_SELECTS.billDueDays).in('invoice_id', ids).order('invoice_id').range(a, b), 'invoice_due_days')))
          return rows
        }, warn)
      : Promise.resolve<BillDueDayDbRow[]>([]),
  ])
  const payCalendars = payTermRowsOf(calendars, dueDays)
  // No calendar, no clock to move: the accepted days are read only when a calendar could use one. A bill's own day counts from nothing.
  if (!calendars?.length || !invoiceIds.length) return { payCalendars, acceptedDays: null }
  const acceptedDays = await soft(async () => {
    const days: Record<string, string> = {}
    for (const ids of chunks(invoiceIds, CHUNK)) {
      const rows = await all<{ invoice_id: string | null; accepted_on: string | null }>((a, b) => admin.from('invoice_payer_acceptances').select(PIPELINE_SELECTS.acceptedDays).in('invoice_id', ids).order('invoice_id').range(a, b), 'invoice_payer_acceptances')
      for (const r of rows) if (r.invoice_id && typeof r.accepted_on === 'string') days[r.invoice_id] = r.accepted_on.slice(0, 10)
    }
    return days
  }, warn)
  return { payCalendars, acceptedDays }
}
