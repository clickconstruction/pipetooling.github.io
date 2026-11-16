/**
 * The morning run's own read of the pay terms (punch list #341, v2.7452): `readPayTerms` is the code
 * `messages-nudge-dispatch` runs, here over a made-up database. The same stored rows are read twice, once as a
 * screen reads them (`payCalendarIo.ts`, then the Pipeline's own call of the pay model) and once as the morning
 * run does, and a bill's due day must come out the same: on terms in days after the bill, on a bill with a due
 * day of its own, and from the day a payer accepted it. Each read is soft alone.
 */
import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database'
import { readPayTerms } from '../../../supabase/functions/_shared/payTermsRead'
import type { PaySpeedData } from '../jobs/billedExpectedPay'
import { billedPayModel, billHeldDay } from '../jobs/billedDuePay'
import { paySpeedPayer } from '../jobs/billToParty'
import { calendarSourceFor, indexPayCalendars } from '../jobs/payCalendar'
import { loadInvoiceAcceptances, loadPayCalendars } from '../jobs/payCalendarIo'
import type { ContactRow } from './load'
import { paidRounds, type PipelineInvoiceRow, type PipelineJobRow } from './residentialLoad'
import { NO_PIPELINE_ROWS, PIPELINE_SELECTS, residentialRowsOf, type PipelineRows } from './residentialRows'

const NOW = new Date('2026-10-12T17:00:00Z')
const TODAY = '2026-10-12'
const DANA: ContactRow = { id: 'c-dana', kind: 'customer', off_since: null, off_why: null, off_by: null }
const WHO = { contact: DANA, firstName: 'Dana', customerId: 'cust-dana' }

const PAY_SPEEDS: PaySpeedData = {
  company: { medianDays: 21, samples: 40 },
  customers: { 'cust-dana': { medianDays: 9, samples: 2 } },
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
}

const job = (id: string): PipelineJobRow => ({ id, created_at: '2026-10-03T13:00:00Z', status: 'billed', revenue: 1850, customer_id: 'cust-dana', gc_customer_id: null, bill_to_party: 'customer', customer_name: 'Dana Whitfield' })
/** Billed Fri Oct 9: due Oct 18 at her own 9 days. */
const bill = (id: string, jobId: string): PipelineInvoiceRow => ({
  id,
  job_id: jobId,
  status: 'billed',
  amount: 1850,
  sequence_order: 1,
  billed_at: '2026-10-09T15:00:00Z',
  sent_to_customer_at: null,
  estimated_bill_date: null,
  created_at: '2026-10-08T22:00:00Z',
  sent_by_user_id: 'u-rosa',
  bill_to_party: null,
  bill_to_email: null,
})

const JOBS = [job('job-1312'), job('job-1313')]
/** One bill on her terms, one with a day of its own. */
const BILLS = [bill('inv-terms', 'job-1312'), bill('inv-own', 'job-1313')]

type Row = Record<string, unknown>
type Tables = Partial<Record<'payer_pay_calendars' | 'invoice_due_days' | 'invoice_payer_acceptances', Row[] | { fails: string }>>

/** Paid 45 days after the bill, as the table stores it. */
const NET_45: Row = { payer_customer_id: 'cust-dana', job_id: null, off: false, cutoff_day: null, pay_day: null, months_after: 1, pay_when_paid: false, clause: '§ 7.1', words: '', set_at: '2026-10-01T15:00:00Z', set_by: null, days_after: 45 }
const OWN_DAY: Row = { invoice_id: 'inv-own', due_on: '2027-02-15', clause: '§ 9.4', words: 'Retainage is released 60 days after final acceptance.', marked_at: '2026-10-10T15:00:00Z', marked_by: null }
const STORED: Tables = { payer_pay_calendars: [NET_45], invoice_due_days: [OWN_DAY], invoice_payer_acceptances: [] }

/**
 * One made-up database for both readers: a read is awaited bare, as the client does, or after `.in`, `.order`
 * and `.range`, as the function does. A column the table does not hold answers nothing, as PostgREST's select does.
 */
function fakeDb(tables: Tables) {
  const selects: Array<{ table: string; columns: string; ins: Array<{ column: string; values: unknown[] }> }> = []
  const db = {
    from: (table: string) => ({
      select: (columns: string) => {
        const call = { table, columns, ins: [] as Array<{ column: string; values: unknown[] }> }
        selects.push(call)
        let range: [number, number] | null = null
        const answer = () => {
          const stored = tables[table as keyof Tables] ?? []
          if (!Array.isArray(stored)) return { data: null, error: { code: '57014', message: stored.fails } }
          const wanted = columns.split(',').map((c) => c.trim())
          const kept = stored.filter((r) => call.ins.every((f) => f.values.includes(r[f.column])))
          const page = range ? kept.slice(range[0], range[1] + 1) : kept
          return { data: page.map((r) => Object.fromEntries(wanted.map((c) => [c, r[c]]))), error: null }
        }
        const chain = {
          eq: (column: string, value: unknown) => (call.ins.push({ column, values: [value] }), chain),
          in: (column: string, values: unknown[]) => (call.ins.push({ column, values }), chain),
          order: () => chain,
          range: (a: number, b: number) => ((range = [a, b]), chain),
          then: <T>(done: (a: ReturnType<typeof answer>) => T) => Promise.resolve(answer()).then(done),
        }
        return chain
      },
    }),
  }
  return { db, selects }
}

/** The due day a billed row shows on the Pipeline: the screen's loaders, then the Stages tab's own call of the model. */
async function pipelineDueDays(tables: Tables): Promise<Record<string, string | null>> {
  const db = fakeDb(tables).db as unknown as SupabaseClient<Database>
  const index = indexPayCalendars(await loadPayCalendars(db))
  const accepted = await loadInvoiceAcceptances(db)
  const out: Record<string, string | null> = {}
  for (const inv of BILLS) {
    const j = JOBS.find((x) => x.id === inv.job_id)!
    const payer = paySpeedPayer(j, inv)!
    const model = billedPayModel(
      { billedAtIso: inv.billed_at, estBillYmd: inv.estimated_bill_date, customerId: payer.id, payerName: payer.name, acceptedYmd: accepted.get(inv.id) ?? null },
      PAY_SPEEDS,
      TODAY,
      null,
      null,
      calendarSourceFor(index, { payerId: payer.id, jobId: j.id, invoiceId: inv.id }),
    )
    out[inv.id] = billHeldDay(model)?.ymd ?? null
  }
  return out
}

/** The due day the morning run gives the same bills' Paid rounds: its own read, then the kernel it hands the rows to. */
async function morningRun(tables: Tables) {
  const { db, selects } = fakeDb(tables)
  const warnings: string[] = []
  const terms = await readPayTerms(db, BILLS.map((b) => b.id), (m) => warnings.push(m))
  const read: PipelineRows = { ...NO_PIPELINE_ROWS, jobs: JOBS, invoices: BILLS, paySpeeds: PAY_SPEEDS, ...terms }
  const dana = residentialRowsOf(read, WHO)
  const dueDays: Record<string, string | null> = {}
  for (const j of JOBS) for (const round of paidRounds(dana, j.id, NOW)) dueDays[round.key] = round.due
  return { terms, dueDays, warnings, selects }
}

describe('the morning run reads a bill’s pay terms as the Pipeline does', () => {
  it('gives terms in days and a bill’s own day the due day the billed row shows', async () => {
    const run = await morningRun(STORED)
    // Billed Oct 9 on 45 days: Nov 23. The other bill's contract names Feb 15.
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-11-23', 'inv-own': '2027-02-15' })
    expect(run.dueDays).toEqual(await pipelineDueDays(STORED))
    expect(run.warnings).toEqual([])
  })

  it('counts the days from the day they accepted the bill, as the row does', async () => {
    const tables: Tables = { ...STORED, invoice_payer_acceptances: [{ invoice_id: 'inv-terms', accepted_on: '2026-10-14' }] }
    const run = await morningRun(tables)
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-11-28', 'inv-own': '2027-02-15' })
    expect(run.dueDays).toEqual(await pipelineDueDays(tables))
  })

  it('reads the pace with nothing stored, as before', async () => {
    const none: Tables = { payer_pay_calendars: [], invoice_due_days: [], invoice_payer_acceptances: [] }
    const run = await morningRun(none)
    expect(run.terms).toEqual({ payCalendars: [], acceptedDays: null })
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-10-18', 'inv-own': '2026-10-18' })
    expect(run.dueDays).toEqual(await pipelineDueDays(none))
  })

  it('selects the days with the calendars, and the own days of these bills alone', async () => {
    const { selects } = await morningRun(STORED)
    const calendars = selects.find((s) => s.table === 'payer_pay_calendars')
    expect(calendars?.columns).toBe(PIPELINE_SELECTS.payCalendars)
    expect(calendars?.columns).toContain('days_after')
    const days = selects.find((s) => s.table === 'invoice_due_days')
    expect(days?.columns).toBe(PIPELINE_SELECTS.billDueDays)
    expect(days?.ins).toEqual([{ column: 'invoice_id', values: ['inv-terms', 'inv-own'] }])
  })

  it('reads no accepted day when no calendar could count from one', async () => {
    const run = await morningRun({ payer_pay_calendars: [], invoice_due_days: [OWN_DAY], invoice_payer_acceptances: [{ invoice_id: 'inv-own', accepted_on: '2026-10-14' }] })
    expect(run.selects.map((s) => s.table)).toEqual(['payer_pay_calendars', 'invoice_due_days'])
    expect(run.terms.acceptedDays).toBeNull()
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-10-18', 'inv-own': '2027-02-15' })
  })

  it('reads no bill’s day on a morning with no bill', async () => {
    const { db, selects } = fakeDb(STORED)
    const terms = await readPayTerms(db, [], () => {})
    expect(selects.map((s) => s.table)).toEqual(['payer_pay_calendars'])
    expect(terms.payCalendars).toHaveLength(1)
    expect(terms.acceptedDays).toBeNull()
  })
})

describe('each of the morning run’s pay term reads is soft alone', () => {
  it('keeps a bill’s own day when the calendars cannot be read', async () => {
    const run = await morningRun({ ...STORED, payer_pay_calendars: { fails: 'canceling statement due to statement timeout' } })
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-10-18', 'inv-own': '2027-02-15' })
    expect(run.warnings).toEqual(['payer_pay_calendars: canceling statement due to statement timeout'])
  })

  it('keeps the calendars when the bills’ own days cannot be read', async () => {
    const run = await morningRun({ ...STORED, invoice_due_days: { fails: 'permission denied for table invoice_due_days' } })
    // The bill with a day of its own reads her terms, as it did before the day was read at all.
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-11-23', 'inv-own': '2026-11-23' })
    expect(run.warnings).toEqual(['invoice_due_days: permission denied for table invoice_due_days'])
  })

  it('counts from the day the bill went in when the accepted days cannot be read', async () => {
    const run = await morningRun({ ...STORED, invoice_payer_acceptances: { fails: 'canceling statement due to statement timeout' } })
    expect(run.terms.acceptedDays).toBeNull()
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-11-23', 'inv-own': '2027-02-15' })
    expect(run.warnings).toEqual(['invoice_payer_acceptances: canceling statement due to statement timeout'])
  })

  it('reads the pace, and says why for each read it tried, when nothing can be read', async () => {
    const fails = { fails: 'the database is not answering' }
    const run = await morningRun({ payer_pay_calendars: fails, invoice_due_days: fails, invoice_payer_acceptances: fails })
    expect(run.terms).toEqual({ payCalendars: null, acceptedDays: null })
    expect(run.dueDays).toEqual({ 'inv-terms': '2026-10-18', 'inv-own': '2026-10-18' })
    // With no calendar read there is no clock to move, so the accepted days are not asked for.
    expect(run.warnings).toEqual(['payer_pay_calendars: the database is not answering', 'invoice_due_days: the database is not answering'])
  })
})
