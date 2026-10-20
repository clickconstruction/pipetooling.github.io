/**
 * They owe us over made-up bills, the people of card 6 in `customer-messages-integrations-mockups.html` (branch
 * spike/gc-mode, v0.2): Dana Whitfield's invoice 1312 at 20 days with a reminder on Oct 15, Marcus Bell's 1288 at 6
 * days with none, a paid job that must not appear, and a GC project's bill that is Owner Billing's. Today is Tue Oct 20,
 * noon in Central time; the company pays in 14 days.
 */
import { describe, expect, it } from 'vitest'
import type { PaySpeedData } from '../jobs/billedExpectedPay'
import { plainWordsFailures } from '../plainWords'
import {
  REMINDER_WORDS,
  billDueDay,
  billMoney,
  reminderLine,
  theyOweLine,
  theyOweUs,
  theyOweUsCount,
  type BillInvoiceRow,
  type BillJobRow,
  type BillPaymentRow,
  type ReminderFills,
  type TheyOweContact,
  type TheyOweUsBills,
} from './theyOweUs'

const NOW = new Date('2026-10-20T17:00:00Z')
const DANA_BILL = '11111111-1111-4111-8111-111111111312'
const MARCUS_BILL = '22222222-2222-4222-8222-222222221288'
const PAID_BILL = '33333333-3333-4333-8333-333333333333'
const GC_BILL = '44444444-4444-4444-8444-444444444444'

const speeds = (customers: PaySpeedData['customers'] = {}): PaySpeedData => ({
  company: { medianDays: 14, samples: 40 },
  customers,
  segments: { residential: null, commercial: null },
  customerTypes: {},
  receipts: {},
  quality: null,
})

const job = (over: Partial<BillJobRow> & Pick<BillJobRow, 'id'>): BillJobRow => ({
  status: 'billed',
  job_name: '',
  hcp_number: '',
  click_number: '',
  revenue: 0,
  payments_made: 0,
  collections_at: null,
  uncollectible_at: null,
  billing_only: false,
  customer_id: null,
  gc_customer_id: null,
  bill_to_party: 'customer',
  last_bill_date: null,
  ...over,
})

const bill = (over: Partial<BillInvoiceRow> & Pick<BillInvoiceRow, 'id' | 'job_id'>): BillInvoiceRow => ({
  status: 'billed',
  amount: 0,
  sequence_order: 1,
  billed_at: null,
  estimated_bill_date: null,
  bill_to_party: null,
  bill_to_email: null,
  stripe_invoice_id: null,
  ...over,
})

const person = (id: string, name: string, customerId: string): TheyOweContact => ({
  id,
  kind: 'customer',
  name,
  goesBy: null,
  record: { table: 'customers', id: customerId },
  customerId,
})

const CONTACTS: TheyOweContact[] = [
  person('dana', 'Dana Whitfield', 'c-dana'),
  person('marcus', 'Marcus Bell', 'c-marcus'),
  person('elena', 'Elena Ortiz', 'c-elena'),
  person('owner', 'Hillside Owner LLC', 'c-owner'),
]

function demo(over: Partial<TheyOweUsBills> = {}): TheyOweUsBills {
  return {
    jobs: [
      job({ id: 'j-oak', job_name: 'Oakridge sewer line', hcp_number: '1312', revenue: 4850, customer_id: 'c-dana' }),
      job({ id: 'j-bell', job_name: 'Bell kitchen sink', hcp_number: '1288', revenue: 640, customer_id: 'c-marcus' }),
      job({ id: 'j-paid', status: 'paid', job_name: 'Ortiz water heater', hcp_number: '1270', revenue: 2100, payments_made: 2100, customer_id: 'c-elena' }),
      job({ id: 'j-gc', status: 'working', billing_only: true, job_name: 'Hillside clinic', click_number: 'C210', customer_id: 'c-owner' }),
    ],
    invoices: [
      // Billed Wed Sep 30 at 10 am Central: 20 days ago, due Oct 14 at the company's 14 days.
      bill({ id: DANA_BILL, job_id: 'j-oak', amount: 4850, billed_at: '2026-09-30T15:00:00Z', stripe_invoice_id: 'in_dana' }),
      // A paper bill on Wed Oct 14: 6 days ago, due Oct 28.
      bill({ id: MARCUS_BILL, job_id: 'j-bell', amount: 640, billed_at: '2026-10-14T15:00:00Z' }),
      bill({ id: PAID_BILL, job_id: 'j-paid', status: 'paid', amount: 2100, billed_at: '2026-09-01T15:00:00Z', stripe_invoice_id: 'in_paid' }),
      // Owner Billing's pay application on the GC project's billing job, 40 days out and open.
      bill({ id: GC_BILL, job_id: 'j-gc', amount: 18000, billed_at: '2026-09-10T15:00:00Z', stripe_invoice_id: 'in_gc' }),
    ],
    payments: [{ invoice_id: PAID_BILL, job_id: 'j-paid', amount: 2100, paid_on: '2026-09-20', sequence_order: 1 }],
    sends: [
      { jobs_ledger_invoice_id: DANA_BILL, sent_at: '2026-09-30T15:05:00Z' },
      { jobs_ledger_invoice_id: DANA_BILL, sent_at: '2026-10-15T14:00:00Z' },
      { jobs_ledger_invoice_id: GC_BILL, sent_at: '2026-09-10T15:05:00Z' },
      { jobs_ledger_invoice_id: GC_BILL, sent_at: '2026-10-01T15:05:00Z' },
    ],
    paySpeeds: speeds(),
    promises: null,
    ...over,
  }
}

/** The words as the customer reads them: each blank filled from the row. */
function filled(text: string, fills: ReminderFills): string {
  return text.replace(/\{(first|job|amount|link)\}/g, (_, k: keyof ReminderFills) => fills[k])
}

describe('theyOweUs', () => {
  const rows = theyOweUs(demo(), CONTACTS, NOW)

  it('is one row per person with an open bill: Dana and Marcus, never the paid job or Owner Billing’s bill', () => {
    expect(rows.map((r) => r.contactId)).toEqual(['dana', 'marcus'])
    expect(rows.some((r) => r.invoiceId === PAID_BILL || r.invoiceId === GC_BILL)).toBe(false)
  })

  it('reads the bill: the invoice, the amount, the days since billed and the last reminder', () => {
    expect(rows[0]).toMatchObject({
      first: 'Dana',
      name: 'Dana Whitfield',
      customerId: 'c-dana',
      jobId: 'j-oak',
      invoiceId: DANA_BILL,
      number: '1312',
      job: 'Oakridge sewer line',
      amount: 4850,
      billedYmd: '2026-09-30',
      daysBilled: 20,
      lastReminderYmd: '2026-10-15',
      more: 0,
    })
    expect(rows[1]).toMatchObject({ invoiceId: MARCUS_BILL, number: '1288', amount: 640, daysBilled: 6, lastReminderYmd: null })
  })

  it('puts the soonest due first and flags the late row by the payer’s pace', () => {
    expect(rows.map((r) => [r.dueYmd, r.late, r.daysLate])).toEqual([
      ['2026-10-14', true, 6],
      ['2026-10-28', false, 0],
    ])
  })

  it('writes the row’s line and its age as card 6 draws them', () => {
    expect(rows.map((r) => r.line)).toEqual([
      'invoice 1312 · $4,850 · 20 days · last reminder Oct 15',
      'invoice 1288 · $640 · 6 days · no reminder yet',
    ])
    expect(rows.map((r) => r.age)).toEqual(['20 d', '6 d'])
  })

  it('links a Stripe bill to its pay page and leaves a paper bill without one', () => {
    expect(rows[0]!.payUrl).toBe(`https://clicktooling.com/pay/${DANA_BILL}`)
    expect(rows[1]!.payUrl).toBeNull()
  })

  it('counts each person with a late bill on the badge', () => {
    expect(theyOweUsCount(rows)).toBe(1)
    expect(theyOweUsCount([])).toBe(0)
  })

  it('leaves out a bill fully paid but not yet marked Paid, and one marked Uncollectible', () => {
    const b = demo()
    const settled = theyOweUs({ ...b, payments: [...b.payments, { invoice_id: MARCUS_BILL, job_id: 'j-bell', amount: 640, paid_on: '2026-10-19', sequence_order: 1 }] }, CONTACTS, NOW)
    expect(settled.map((r) => r.contactId)).toEqual(['dana'])
    const given = theyOweUs({ ...b, jobs: b.jobs.map((j) => (j.id === 'j-oak' ? { ...j, collections_at: '2026-10-16T15:00:00Z', uncollectible_at: '2026-10-18T15:00:00Z' } : j)) }, CONTACTS, NOW)
    expect(given.map((r) => r.contactId)).toEqual(['marcus'])
  })

  it('keeps a bill in Collections, and nets what was paid on it', () => {
    const b = demo()
    const partPaid: BillPaymentRow = { invoice_id: DANA_BILL, job_id: 'j-oak', amount: 1000, paid_on: '2026-10-10', sequence_order: 1 }
    const out = theyOweUs({ ...b, jobs: b.jobs.map((j) => (j.id === 'j-oak' ? { ...j, collections_at: '2026-10-16T15:00:00Z' } : j)), payments: [...b.payments, partPaid] }, CONTACTS, NOW)
    expect(out[0]).toMatchObject({ contactId: 'dana', amount: 3850, late: true })
  })

  it('shows each person once with their worst bill and says how many more are open', () => {
    const b = demo()
    const second = bill({ id: '55555555-5555-4555-8555-555555555555', job_id: 'j-oak2', amount: 300, billed_at: '2026-10-12T15:00:00Z', stripe_invoice_id: 'in_2' })
    const out = theyOweUs(
      {
        ...b,
        jobs: [...b.jobs, job({ id: 'j-oak2', job_name: 'Whitfield hose bib', hcp_number: '1330', revenue: 300, customer_id: 'c-dana' })],
        invoices: [...b.invoices, second],
      },
      CONTACTS,
      NOW,
    )
    expect(out.map((r) => [r.contactId, r.invoiceId, r.more])).toEqual([
      ['dana', DANA_BILL, 1],
      ['marcus', MARCUS_BILL, 0],
    ])
    expect(out[0]!.line).toBe('invoice 1312 · $4,850 · 20 days · last reminder Oct 15 · 1 more bill')
  })

  it('takes a promise over the pace', () => {
    const out = theyOweUs(demo({ promises: { 'j-oak': { promisedYmd: '2026-10-23', markedByName: 'Rosa' } } }), CONTACTS, NOW)
    expect(out.map((r) => [r.contactId, r.dueYmd, r.late])).toEqual([
      ['dana', '2026-10-23', false],
      ['marcus', '2026-10-28', false],
    ])
  })

  it('reads nothing late without pay speeds, and puts the longest billed first', () => {
    const out = theyOweUs(demo({ paySpeeds: null }), CONTACTS, NOW)
    expect(out.map((r) => [r.contactId, r.dueYmd, r.late])).toEqual([
      ['dana', null, false],
      ['marcus', null, false],
    ])
    expect(theyOweUsCount(out)).toBe(0)
  })

  it('leaves a payer with no contact yet on the AR page', () => {
    const out = theyOweUs(demo(), CONTACTS.filter((c) => c.id !== 'marcus'), NOW)
    expect(out.map((r) => r.contactId)).toEqual(['dana'])
  })

  it('reads a job balance with no bill row by its last bill date, with no pace and no pay page', () => {
    const b = demo()
    const out = theyOweUs(
      { ...b, invoices: b.invoices.filter((i) => i.id !== MARCUS_BILL), jobs: b.jobs.map((j) => (j.id === 'j-bell' ? { ...j, last_bill_date: '2026-10-08' } : j)) },
      CONTACTS,
      NOW,
    )
    expect(out[1]).toMatchObject({ contactId: 'marcus', invoiceId: null, amount: 640, daysBilled: 12, dueYmd: null, payUrl: null, line: 'job 1288 balance · $640 · 12 days · no reminder yet' })
  })
})

describe('billDueDay', () => {
  it('reads the GC’s pace on a GC-billed bill, the payer the pay speeds are keyed on', () => {
    const gcJob = { customer_id: 'c-dana', gc_customer_id: 'c-gc', bill_to_party: 'gc', customer_name: 'Dana Whitfield' }
    const inv = { billed_at: '2026-09-30T15:00:00Z', estimated_bill_date: null, bill_to_party: null, bill_to_email: null }
    expect(billDueDay(gcJob, inv, speeds({ 'c-gc': { medianDays: 45, samples: 6 } }), null, '2026-10-20')).toMatchObject({ expectedYmd: '2026-11-14', state: 'upcoming', source: 'customer' })
    expect(billDueDay({ ...gcJob, bill_to_party: 'customer' }, inv, speeds({ 'c-gc': { medianDays: 45, samples: 6 } }), null, '2026-10-20')).toMatchObject({ expectedYmd: '2026-10-14', state: 'late', source: 'company' })
  })

  it('has no day without pay speeds or a billed day', () => {
    const j = { customer_id: 'c-dana', gc_customer_id: null, bill_to_party: 'customer' }
    expect(billDueDay(j, { billed_at: '2026-09-30T15:00:00Z', estimated_bill_date: null, bill_to_party: null, bill_to_email: null }, null, null, '2026-10-20')).toBeNull()
    expect(billDueDay(j, { billed_at: null, estimated_bill_date: null, bill_to_party: null, bill_to_email: null }, speeds(), null, '2026-10-20')).toBeNull()
  })
})

describe('reminderLine', () => {
  const rows = theyOweUs(demo(), CONTACTS, NOW)

  it('is a team quick reply for customers on the Paid step', () => {
    const { reply } = reminderLine(rows[0]!, 'en')
    expect(reply).toMatchObject({ for: 'customer', stepId: 'paid', scope: 'team', removed: false, uses: {}, lastUsed: null })
  })

  it('links Dana’s bill, in English and in Spanish', () => {
    const en = reminderLine(rows[0]!, 'en')
    expect(en.reply.text).toBe('{first}, your bill for {job} has {amount} still open. Pay it here: {link}')
    expect(en.fills).toEqual({ first: 'Dana', job: 'Oakridge sewer line', amount: '$4,850', link: `https://clicktooling.com/pay/${DANA_BILL}` })
    expect(filled(en.reply.text, en.fills)).toBe(`Dana, your bill for Oakridge sewer line has $4,850 still open. Pay it here: https://clicktooling.com/pay/${DANA_BILL}`)
    const es = reminderLine(rows[0]!, 'es')
    expect(filled(es.reply.text, es.fills)).toBe(`Dana, su factura de Oakridge sewer line tiene $4,850 pendiente. Puede pagarla aquí: https://clicktooling.com/pay/${DANA_BILL}`)
  })

  it('asks Marcus for his day, his paper bill having no pay page', () => {
    const en = reminderLine(rows[1]!, 'en')
    expect(en.reply.text).not.toContain('{link}')
    expect(filled(en.reply.text, en.fills)).toBe('Marcus, your bill for Bell kitchen sink has $640 still open. Reply with the day you will pay.')
    const es = reminderLine(rows[1]!, 'es')
    expect(filled(es.reply.text, es.fills)).toBe('Marcus, su factura de Bell kitchen sink tiene $640 pendiente. Responda con el día en que pagará.')
  })

  it('keeps every line in plain words, blank and filled', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const text of Object.values(REMINDER_WORDS[lang])) expect(plainWordsFailures(text)).toEqual([])
      for (const row of rows) {
        const { reply, fills } = reminderLine(row, lang)
        expect(plainWordsFailures(filled(reply.text, fills))).toEqual([])
      }
    }
  })
})

describe('the words', () => {
  it('says money as the bill does', () => {
    expect([billMoney(4850), billMoney(640.5), billMoney(1234.567), billMoney(0)]).toEqual(['$4,850', '$640.50', '$1,234.57', '$0'])
  })

  it('names a bill with no number, one billed today, and more than one more', () => {
    expect(theyOweLine({ invoiceId: 'x', number: '', amount: 90, daysBilled: 0, lastReminderYmd: null, more: 2 })).toBe('a bill · $90 · billed today · no reminder yet · 2 more bills')
    expect(theyOweLine({ invoiceId: null, number: '', amount: 90, daysBilled: 1, lastReminderYmd: '2026-10-02', more: 0 })).toBe('a job balance · $90 · 1 day · last reminder Oct 2')
  })
})
