import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from './jobFormTypes'
import { billPaidBar, billSentYmd, daysAfterBill, instrumentWord, orderMoneyByDate, paymentLineWords, paymentSource, sourceWords, splitBillsAndPayments } from './billsAndPayments'

function payment(over: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: 'p1',
    amount: 11700,
    paid_on: '2026-09-14',
    sent_on: null,
    note: null,
    payment_type: null,
    reference_number: null,
    invoice_id: 'inv-a',
    mercury_transaction_id: null,
    ...over,
  }
}

function invoice(over: Partial<JobsLedgerInvoiceRow> = {}): JobsLedgerInvoiceRow {
  return { id: 'inv-a', status: 'billed', amount: 26800, sent_to_customer_at: '2026-07-15T12:00:00Z', ...over } as unknown as JobsLedgerInvoiceRow
}

function job(invoices: JobsLedgerInvoiceRow[]): JobWithDetails {
  return { id: 'job1', invoices } as unknown as JobWithDetails
}

const bankCheck = { postedYmd: '2026-09-14', counterparty: 'Loberg Contracting', kind: 'checkDeposit', status: 'sent', failureReason: null }

describe('instrumentWord — the eight spellings of three things', () => {
  it('reads check, cheque and checkDeposit as check; Card (external) as card; ACH as ach; nothing as null', () => {
    expect(instrumentWord('Cheque')).toBe('check')
    expect(instrumentWord('Check')).toBe('check')
    expect(instrumentWord('checkDeposit')).toBe('check')
    expect(instrumentWord('Card (external)')).toBe('card')
    expect(instrumentWord('ACH')).toBe('ach')
    expect(instrumentWord('other')).toBeNull()
    expect(instrumentWord(null)).toBeNull()
  })
})

describe('paymentSource — the chip comes from where the row came from', () => {
  it('a bank-linked row is a bank deposit, worded by the bank kind', () => {
    const src = paymentSource(payment({ mercury_transaction_id: 'mt1', payment_type: 'checkDeposit' }), job([invoice()]), bankCheck)
    expect(src).toEqual({ kind: 'bank', chip: 'Check · bank deposit', instrument: 'check' })
    expect(paymentSource(payment({ mercury_transaction_id: 'mt1' }), job([invoice()]), { ...bankCheck, kind: 'incomingDomesticWire' }).chip).toBe('Wire · bank deposit')
    expect(paymentSource(payment({ mercury_transaction_id: 'mt1' }), job([invoice()]), null).chip).toBe('Bank deposit')
  })
  it('a row on a Stripe bill is a card unless the office recorded a check or cash through Stripe', () => {
    const stripeJob = job([invoice({ stripe_invoice_id: 'in_1', external_send_channel: 'stripe' } as Partial<JobsLedgerInvoiceRow>)])
    expect(paymentSource(payment({ note: 'Stripe' }), stripeJob).chip).toBe('Card · Stripe')
    expect(paymentSource(payment({ payment_type: 'check', stripe_credit_note_id: 'cn_1' }), stripeJob).chip).toBe('Check · recorded in Stripe')
    expect(paymentSource(payment({ payment_type: 'Cash' }), stripeJob).chip).toBe('Cash · recorded in Stripe')
  })
  it('anything else was typed by hand, with the type word when there is one', () => {
    expect(paymentSource(payment({ payment_type: 'Cheque' }), job([invoice()])).chip).toBe('Check · typed by hand')
    expect(paymentSource(payment(), job([invoice()])).chip).toBe('Typed by hand')
    expect(paymentSource(payment({ invoice_id: null }), null).kind).toBe('hand')
  })
})

describe('daysAfterBill and billSentYmd', () => {
  it('counts whole days from the bill going out, from the sent stamp else the billed stamp', () => {
    expect(billSentYmd({ sent_to_customer_at: '2026-07-15T12:00:00Z', billed_at: '2026-07-10T17:00:00Z' })).toBe('2026-07-15')
    expect(billSentYmd({ sent_to_customer_at: null, billed_at: '2026-07-10T17:00:00Z' })).toBe('2026-07-10')
    expect(billSentYmd({ sent_to_customer_at: null, billed_at: null })).toBeNull()
    // An evening stamp is its own Central day: 7:30 pm CDT on Oct 2 (also as +00:00), 6:30 pm CST on Dec 1, noon UTC.
    expect(billSentYmd({ sent_to_customer_at: '2026-10-03T00:30:00+00:00', billed_at: null })).toBe('2026-10-02')
    expect(billSentYmd({ sent_to_customer_at: null, billed_at: '2026-12-02T00:30:00Z' })).toBe('2026-12-01')
    expect(billSentYmd({ sent_to_customer_at: null, billed_at: '2026-10-03T12:00:00Z' })).toBe('2026-10-03')
    expect(daysAfterBill('2026-07-15', '2026-09-14')).toBe(61)
    expect(daysAfterBill('2026-07-15', '2026-09-28')).toBe(75)
    expect(daysAfterBill(null, '2026-09-28')).toBeNull()
  })
})

describe('paymentLineWords — the line under a bill', () => {
  it('a bank check names the payer, the days and the bank reference never shows', () => {
    const row = payment({ mercury_transaction_id: 'mt1', payment_type: 'checkDeposit', reference_number: '4ed0c1d2-0000-4000-8000-0000000003c1' })
    const words = paymentLineWords({ slice: { payment: row, amount: 11700, partial: false }, source: paymentSource(row, job([invoice()]), bankCheck), billSentYmd: '2026-07-15', bank: bankCheck })
    expect(words.dateText).toBe('Sep 14')
    expect(words.who).toBe('check from Loberg Contracting')
    expect(words.daysText).toBe('61 d')
    expect(words.daysTone).toBe('ok')
    expect(words.pinned).toBe(true)
    expect(words.countedHere).toBe(false)
    expect(words.detail).toBeNull()
    expect(words.checkDated).toBeNull()
    expect(words.returned).toBeNull()
  })
  it('a hand-typed check carries its number and memo, its check date when entered, and says when it came before the bill', () => {
    const row = payment({ paid_on: '2026-07-02', sent_on: '2026-07-01', payment_type: 'Check', reference_number: '1017', note: 'deposit for the rough-in' })
    const words = paymentLineWords({ slice: { payment: row, amount: 1800, partial: false }, source: paymentSource(row, job([invoice()])), billSentYmd: '2026-07-15' })
    expect(words.detail).toBe('check 1017 · deposit for the rough-in')
    expect(words.checkDated).toBe('check dated Jul 1')
    expect(words.daysText).toBe('13 d before the bill')
    expect(words.daysTone).toBe('before-bill')
  })
  it('an unpinned payment the oldest-first rule placed reads as counted here, and a split one as partial', () => {
    const row = payment({ invoice_id: null })
    const words = paymentLineWords({ slice: { payment: row, amount: 5000, partial: true }, source: paymentSource(row, null), billSentYmd: null })
    expect(words.pinned).toBe(false)
    expect(words.countedHere).toBe(true)
    expect(words.partial).toBe(true)
    expect(words.daysText).toBeNull()
  })
  it('a deposit the bank returned says so with the reason, and a card row says Stripe wrote it', () => {
    const row = payment({ mercury_transaction_id: 'mt1' })
    const bank = { ...bankCheck, status: 'failed', failureReason: 'Insufficient funds' }
    expect(paymentLineWords({ slice: { payment: row, amount: 3000, partial: false }, source: paymentSource(row, null, bank), billSentYmd: null, bank }).returned).toBe('Returned by the bank · Insufficient funds')
    const stripeJob = job([invoice({ stripe_invoice_id: 'in_1', external_send_channel: 'stripe' } as Partial<JobsLedgerInvoiceRow>)])
    const card = payment({ note: 'Stripe' })
    expect(paymentLineWords({ slice: { payment: card, amount: 2500, partial: false }, source: paymentSource(card, stripeJob), billSentYmd: '2026-07-30' }).detail).toBe('Stripe wrote this row')
  })
})

describe('billPaidBar', () => {
  it('one segment per slice as a share of the bill, never past the whole', () => {
    const bar = billPaidBar(26800, [
      { payment: payment({ id: 'a' }), amount: 11700, partial: false },
      { payment: payment({ id: 'b' }), amount: 6077.51, partial: false },
    ])
    expect(bar.segments.map((s) => s.paymentId)).toEqual(['a', 'b'])
    expect(bar.segments[0]!.frac).toBeCloseTo(0.4366, 3)
    expect(bar.paidFrac).toBeCloseTo(0.6633, 3)
    const over = billPaidBar(1000, [{ payment: payment({ id: 'a' }), amount: 1500, partial: false }])
    expect(over.paidFrac).toBe(1)
    expect(billPaidBar(0, [])).toEqual({ segments: [], paidFrac: 0 })
  })
})

describe('splitBillsAndPayments — where every payment is drawn', () => {
  it('pinned rows sit under their bill; an unpinned one sits under the bill oldest-first counts it toward; surplus stays on no bill', () => {
    const invoices = [invoice({ id: 'old', amount: 1000, sent_to_customer_at: '2026-07-01T00:00:00Z' }), invoice({ id: 'new', amount: 500, sent_to_customer_at: '2026-08-01T00:00:00Z' })]
    const payments = [
      payment({ id: 'pinned', amount: 400, invoice_id: 'new' }),
      payment({ id: 'loose', amount: 1200, invoice_id: null }),
      payment({ id: 'extra', amount: 250, invoice_id: null, paid_on: '2026-09-20' }),
      payment({ id: 'elsewhere', amount: 90, invoice_id: 'not-listed' }),
    ]
    const split = splitBillsAndPayments(invoices, payments)
    expect(split.slicesByBill.get('new')!.map((s) => [s.payment.id, s.amount])).toEqual([['pinned', 400], ['loose', 100]])
    expect(split.slicesByBill.get('old')!.map((s) => [s.payment.id, s.amount, s.partial])).toEqual([['loose', 1000, true]])
    expect(split.onNoBill.map((p) => p.id)).toEqual(['extra', 'elsewhere'])
    expect(split.surplus).toBeCloseTo(350, 2)
  })
  it('a row not yet saved stays on no bill while it is typed, even when the rule would count it toward a bill', () => {
    const invoices = [invoice({ id: 'old', amount: 1000, sent_to_customer_at: '2026-07-01T00:00:00Z' })]
    const payments = [payment({ id: 'saved', amount: 400, invoice_id: null }), payment({ id: 'draft', amount: 600, invoice_id: null })]
    const split = splitBillsAndPayments(invoices, payments, new Set(['saved']))
    expect(split.slicesByBill.get('old')!.map((s) => s.payment.id)).toEqual(['saved'])
    expect(split.onNoBill.map((p) => p.id)).toEqual(['draft'])
  })
})

describe('orderMoneyByDate — the By date reading', () => {
  it('bills by the day they went out and payments by the day they came, oldest first, a split payment as one row naming both bills, undated last', () => {
    const old = invoice({ id: 'old', amount: 1000, sent_to_customer_at: '2026-07-01T00:00:00Z' })
    const newer = invoice({ id: 'new', amount: 500, sent_to_customer_at: '2026-08-01T00:00:00Z' })
    const draft = invoice({ id: 'draft', amount: 300, status: 'ready_to_bill', sent_to_customer_at: null })
    const loose = payment({ id: 'loose', amount: 1200, invoice_id: null, paid_on: '2026-08-01' })
    const pinned = payment({ id: 'pinned', amount: 100, invoice_id: 'new', paid_on: '2026-07-20' })
    const undated = payment({ id: 'undated', amount: 50, invoice_id: 'old', paid_on: null })
    const split = splitBillsAndPayments([old, newer, draft], [loose, pinned, undated])
    const items = orderMoneyByDate([old, newer, draft], split.slicesByBill)
    expect(items.map((i) => (i.kind === 'bill' ? `bill:${i.inv.id}` : `pay:${i.payment.id}`))).toEqual(['bill:old', 'pay:pinned', 'bill:new', 'pay:loose', 'bill:draft', 'pay:undated'])
    const looseRow = items.find((i) => i.kind === 'payment' && i.payment.id === 'loose')
    expect(looseRow && looseRow.kind === 'payment' ? looseRow.billWords : null).toBe('pays the $1,000 bill and the $500 bill')
    const pinnedRow = items.find((i) => i.kind === 'payment' && i.payment.id === 'pinned')
    expect(pinnedRow && pinnedRow.kind === 'payment' ? pinnedRow.billWords : null).toBe('pays the $500 bill')
  })
})

describe('sourceWords — the line in a sentence', () => {
  it('names the payer on a bank row, the channel on a Stripe row, and the hand on the rest', () => {
    const stripeJob = job([invoice({ stripe_invoice_id: 'in_1', external_send_channel: 'stripe' } as Partial<JobsLedgerInvoiceRow>)])
    expect(sourceWords(paymentSource(payment({ mercury_transaction_id: 'mt1' }), null, bankCheck), bankCheck)).toBe('check from Loberg Contracting')
    expect(sourceWords(paymentSource(payment({ mercury_transaction_id: 'mt1' }), null, { ...bankCheck, counterparty: null }), { ...bankCheck, counterparty: null })).toBe('check · bank deposit')
    expect(sourceWords(paymentSource(payment({ note: 'Stripe' }), stripeJob))).toBe('card through Stripe')
    expect(sourceWords(paymentSource(payment({ payment_type: 'check' }), stripeJob))).toBe('check recorded in Stripe')
    expect(sourceWords(paymentSource(payment({ payment_type: 'Cheque' }), null))).toBe('check · typed by hand')
    expect(sourceWords(paymentSource(payment(), null))).toBe('typed by hand')
  })
})
