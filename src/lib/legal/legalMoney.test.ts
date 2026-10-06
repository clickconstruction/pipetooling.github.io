/**
 * Money that foots (punch list #85, item 5): the statement of account always
 * reaches the Balance, a payment with no bill counts by the app's one rule, a
 * write-down is listed once, and the firm's own contingency never rides into
 * the demand. On the sample matter and on hand-built jobs.
 */
import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { buildLegalPacket, groupCollectionsByPayer, jobOpenBalance, legalJobMoney, type LegalAccountSummary, type LegalPacket, type LegalPacketInput } from './legalPacket'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'
import { CONTINGENCY_ENTRY_META, contingencyEntries, contingencyEntryBody, firmDemand, firmFeeEntries, invoiceSentWords, isContingencyEntry, legalRunningLedger, paymentHowWords } from './legalMoney'
import type { LegalEntryRow } from './legalMatters'

const TODAY = '2026-10-05'

function job(p: Partial<Record<string, unknown>>): JobWithDetails {
  return makeJob({ status: 'billed', collections_at: '2026-09-01T15:00:00Z', customer_id: 'c1', customer_name: 'Sample Contracting', ...p })
}
function bill(id: string, amount: number, billedYmd: string, over: Record<string, unknown> = {}) {
  return makeInvoice({ id, amount, status: 'billed', billed_at: `${billedYmd}T15:00:00Z`, sent_to_customer_at: `${billedYmd}T15:05:00Z`, external_send_channel: 'stripe', stripe_invoice_status: 'open', sequence_order: 1, ...over })
}
function pay(id: string, amount: number, paidOn: string, invoiceId: string | null, over: Record<string, unknown> = {}) {
  return { id, invoice_id: invoiceId, amount, paid_on: paidOn, payment_type: 'check', reference_number: null, ...over }
}
function packetFor(jobs: JobWithDetails[], over: Partial<LegalPacketInput> = {}): LegalPacket {
  const account = groupCollectionsByPayer(jobs, new Map(), TODAY)[0] as LegalAccountSummary
  return buildLegalPacket({ todayYmd: TODAY, account, customer: null, contacts: [], contactEntries: [], addresses: [], contracts: [], signedEstimates: [], demandLetters: [], lienFilings: [], promises: [], promiseOutcomes: [], chaseTouches: [], reports: [], clockSessions: [], threadNotes: [], users: [], ...over })
}
/** The statement foots: the running balance after the last row is the packet's Balance. */
function expectFoots(p: LegalPacket) {
  const rows = legalRunningLedger(p.account.ledger)
  expect(rows[rows.length - 1]?.running ?? 0).toBeCloseTo(p.account.totals.balance, 2)
  expect(p.account.totals.balance).toBeCloseTo(p.account.jobs.reduce((s, j) => s + j.balance, 0), 2)
}
function entry(partial: Partial<LegalEntryRow> & Pick<LegalEntryRow, 'kind' | 'body'>): LegalEntryRow {
  return { id: partial.id ?? partial.body, matter_id: 'm', amount: null, occurred_on: '2026-10-01', meta: {}, via_portal: true, created_by: null, acknowledged_at: null, created_at: '2026-10-01T12:00:00Z', ...partial }
}

describe('(a) an agreed write-down is listed once', () => {
  it('prints the bill at what was billed and the write-down beneath, so the rows add to the balance', () => {
    const j = job({ id: 'j1', hcp_number: '1042', revenue: 18_400, invoices: [bill('i1', 15_900, '2026-06-03', { agreed_write_down_at: '2026-08-01T15:00:00Z', agreed_write_down_previous_amount: 18_400, agreed_write_down_note: 'Punch delay' })], payments: [pay('p1', 4_000, '2026-07-02', 'i1')] })
    const p = packetFor([j])
    expect(p.account.ledger.map((e) => [e.kind, e.amount])).toEqual([['invoice', 18_400], ['payment', -4_000], ['write_down', -2_500]])
    expect(p.account.ledger.find((e) => e.kind === 'write_down')?.text).toBe('Agreed write-down · Punch delay')
    expect(p.account.totals).toMatchObject({ billed: 18_400, paid: 4_000, writtenDown: 2_500, balance: 11_900 })
    expectFoots(p)
  })
  it('does not let the written-down part read as work on no bill, which would swallow a payment with no bill', () => {
    const j = job({ id: 'j1', revenue: 18_400, invoices: [bill('i1', 15_900, '2026-06-03', { agreed_write_down_at: '2026-08-01T15:00:00Z', agreed_write_down_previous_amount: 18_400 })], payments: [pay('p1', 1_000, '2026-09-01', null)] })
    expect(legalJobMoney(j)).toMatchObject({ balance: 14_900, offBill: 0 })
    expectFoots(packetFor([j]))
  })
})

describe('(b) a payment with no bill', () => {
  it('reduces the balance when the job has an open billed line (the one rule: oldest bill first)', () => {
    const j = job({ id: 'j2', hcp_number: '1189', revenue: 6_000, invoices: [bill('i2', 6_000, '2026-07-10')], payments: [pay('p2', 1_500, '2026-08-20', null, { payment_type: 'ACH' })] })
    expect(jobOpenBalance(j)).toBe(4_500)
    const p = packetFor([j])
    expect(p.account.totals.balance).toBe(4_500)
    expect(p.account.ledger.map((e) => e.text)).toEqual(['Invoice · sent 2026-07-10 through Stripe', 'Payment · ACH'])
    expectFoots(p)
  })
  it('pays the work on no bill first, and the statement says so in a row of its own', () => {
    // A $10,000 job billed $4,000 so far: a $6,000 payment with no bill paid the unbilled work, the bill stays open.
    const j = job({ id: 'j3', revenue: 10_000, invoices: [bill('i3', 4_000, '2026-07-10')], payments: [pay('p3', 6_000, '2026-05-01', null)] })
    expect(legalJobMoney(j)).toMatchObject({ balance: 4_000, offBill: 6_000 })
    const p = packetFor([j])
    expect(p.account.ledger.find((e) => e.kind === 'off_bill')).toEqual(expect.objectContaining({ amount: 6_000, ymd: '2026-05-01', text: 'Work on no bill, covered by the payments on this job' }))
    expectFoots(p)
  })
  it('a bill marked paid with no payment recorded is settled, not owed, and the statement says so', () => {
    const j = job({ id: 'j4', revenue: 3_000, invoices: [bill('i4a', 1_000, '2026-06-01', { status: 'paid' }), bill('i4b', 2_000, '2026-07-01')] })
    const p = packetFor([j])
    expect(p.account.totals.balance).toBe(2_000)
    expect(p.account.ledger.find((e) => e.kind === 'settled')).toEqual(expect.objectContaining({ amount: -1_000, ymd: '2026-06-01' }))
    expectFoots(p)
  })
  it('a job with no billed line owes its job total, and the statement shows that total', () => {
    const j = job({ id: 'j5', revenue: 5_000, payments_made: 1_000, last_bill_date: '2026-06-15', invoices: [], payments: [pay('p5', 1_000, '2026-07-01', null)] })
    const p = packetFor([j])
    expect(p.account.totals.balance).toBe(4_000)
    expect(p.account.ledger.find((e) => e.kind === 'off_bill')).toEqual(expect.objectContaining({ amount: 5_000, text: 'Job total, not split into bills' }))
    expectFoots(p)
  })
  it('anything the rows cannot explain is one row that says so, never a silent gap', () => {
    // An unlinked refund the payment rule does not spread: the statement still reaches the balance.
    const j = job({ id: 'j6', revenue: 2_000, invoices: [bill('i6', 2_000, '2026-06-01')], payments: [pay('p6', -300, '2026-07-01', null)] })
    const p = packetFor([j])
    expect(p.account.ledger.some((e) => e.kind === 'unexplained' || e.text.startsWith('Refund'))).toBe(true)
    expectFoots(p)
  })
})

describe('(c) the firm\'s demand', () => {
  const rows = [
    entry({ kind: 'fee', body: 'Demand letter', amount: 450 }),
    entry({ kind: 'cost', body: 'Filing fee', amount: 350 }),
    entry({ kind: 'recovery_applied', body: 'Applied to the job', amount: 3_000, via_portal: false }),
    entry({ kind: 'cost', body: contingencyEntryBody(0.33, '$3,000.00'), amount: 990, via_portal: false, meta: { ...CONTINGENCY_ENTRY_META } }),
    entry({ kind: 'cost', body: 'Contingency 33% of $1,000.00', amount: 330, via_portal: false }),
  ]
  it('adds the firm\'s fees and costs and never the contingency Mark applied writes (tagged, or by its old wording)', () => {
    expect(firmFeeEntries(rows).map((e) => e.body)).toEqual(['Demand letter', 'Filing fee'])
    expect(contingencyEntries(rows).map((e) => e.amount)).toEqual([990, 330])
    expect(firmDemand(16_400, rows)).toEqual({ feesTotal: 800, demand: 17_200 })
  })
  it('a cost the firm itself entered stays in the demand, whatever its words', () => {
    expect(isContingencyEntry(entry({ kind: 'cost', body: 'Contingency 33% of $1.00', amount: 1, via_portal: true }))).toBe(false)
    expect(contingencyEntryBody(0.33, '$3,000.00')).toBe('Contingency 33% of $3,000.00')
  })
})

describe('(d) plain words on a ledger line', () => {
  it('says how a bill went out and how a payment came in, never the systems\' words', () => {
    expect(invoiceSentWords('stripe_manual', '2026-06-03', true)).toBe('sent 2026-06-03 through Stripe')
    expect(invoiceSentWords('email', '2026-06-03', true)).toBe('sent 2026-06-03 by email')
    expect(invoiceSentWords('physical', null, true)).toBe('sent on paper')
    expect(invoiceSentWords('stripe', '2026-06-03', false)).toBe('never sent')
    expect(paymentHowWords('Cheque', '2291')).toBe('check no. 2291')
    expect(paymentHowWords('ACH', null)).toBe('ACH')
    expect(paymentHowWords('Card (external)', 'ch_1')).toBe('card · ref ch_1')
    expect(paymentHowWords(null, null)).toBe('')
  })
})

describe('(e) the sample matter, as the firm reads it', () => {
  const company = { name: 'Click Plumbing and Electrical', cityLine: 'Kyle, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }
  it('foots, and no raw channel or Stripe status rides into a line', () => {
    const payload = parseLegalPortalPayload(sampleLegalPortalResponse(company, TODAY))!
    const p = buildMatterPacket(payload.matters[0]!, TODAY, portalFeeModel(payload))!
    expectFoots(p)
    expect(p.account.totals.balance).toBe(14_400)
    for (const e of p.account.ledger) expect(e.text).not.toMatch(/stripe_manual|uncollectible|· open|sent email|Cheque/)
    expect(p.account.ledger[0]?.text).toBe('Invoice · sent 2026-06-03 by email')
  })
  it('a harder copy (a write-down, a payment with no bill, a recovery applied) foots and its demand leaves the contingency out', () => {
    const raw = sampleLegalPortalResponse(company, TODAY) as { matters: Array<Record<string, unknown>> }
    const m = JSON.parse(JSON.stringify(raw.matters[0])) as { id: string; jobs: Array<Record<string, unknown>>; entries: LegalEntryRow[] }
    const jobA = m.jobs[0] as Record<string, unknown> & { id: string; invoices: Array<Record<string, unknown>> }
    jobA.invoices = [{ ...jobA.invoices[0], amount: 15_900, agreed_write_down_at: '2026-08-01T15:00:00Z', agreed_write_down_previous_amount: 18_400, external_send_channel: 'stripe_manual', stripe_invoice_status: 'uncollectible' }]
    jobA.payments = [{ id: 'p-a', job_id: jobA.id, invoice_id: jobA.invoices[0]!.id, amount: 4_000, paid_on: '2026-07-02', payment_type: 'Cheque', reference_number: '2291' }]
    const jobB = { ...JSON.parse(JSON.stringify(jobA)), id: 'job-b', hcp_number: '1189', revenue: 6_000, invoices: [{ ...jobA.invoices[0], id: 'inv-b', job_id: 'job-b', amount: 6_000, agreed_write_down_at: null, agreed_write_down_previous_amount: null, billed_at: '2026-07-10T15:00:00Z', sent_to_customer_at: '2026-07-10T15:05:00Z' }], payments: [{ id: 'p-b', job_id: 'job-b', invoice_id: null, amount: 1_500, paid_on: '2026-08-20', payment_type: 'ACH', reference_number: null }] }
    m.jobs = [jobA, jobB]
    m.entries = [...m.entries, entry({ kind: 'cost', body: 'Filing fee', amount: 350 }), entry({ kind: 'cost', body: 'Contingency 33% of $3,000.00', amount: 990, via_portal: false })]
    const payload = parseLegalPortalPayload({ ...raw, matters: [m] })!
    const p = buildMatterPacket(payload.matters[0]!, TODAY, portalFeeModel(payload))!
    expectFoots(p)
    expect(p.account.totals.balance).toBe(16_400)
    expect(legalRunningLedger(p.account.ledger).map((e) => e.running)).toEqual([18_400, 14_400, 20_400, 17_900, 16_400])
    expect(firmDemand(p.account.totals.balance, payload.matters[0]!.entries).demand).toBe(17_200)
  })
})
