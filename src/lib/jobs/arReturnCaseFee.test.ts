/**
 * The returned-check fee (v2.5033; the owner's call of 2026-10-09): what a came-back case says about it — the
 * press, the fee once it is on, or why there is none — and the bill's own fee lines for the printed bill.
 */
import { describe, expect, it } from 'vitest'
import {
  AR_RETURNED_CHECK_FEE,
  AR_RETURNED_CHECK_FEE_LINE,
  AR_RETURNED_CHECK_FEE_STATUTE,
  arCaseFeeOffer,
  billFeeLines,
  returnedCheckFeeCents,
  riderFeeLineCents,
  type ArCaseFeeBill,
  type ArCaseFeeRow,
} from './arReturnCaseFee'
import { buildPhysicalInvoiceDocumentForBilledInvoice } from '../physicalInvoiceDocumentForBilledInvoice'
import type { JobWithDetails } from '../../types/jobWithDetails'

const bill = (over: Partial<ArCaseFeeBill>): ArCaseFeeBill => ({ invoice_id: 'b1', job_id: 'j878', sequence_order: 0, status: 'billed', stripe: false, job_number: '878', job_name: 'Take 5- Seguin', ...over })
const feeRow = (over: Partial<ArCaseFeeRow>): ArCaseFeeRow => ({ case_id: 'tx-sp', fee_amount: null, fee_invoice_id: null, fee_added_at: null, fee_added_by: null, bills: [bill({})], ...over })
const BANK = { source: 'bank' as const }

describe('the statute behind the $30', () => {
  it('is § 3.506(b)’s ceiling as amended in 2011, with (c)’s exclusion on the hover', () => {
    expect(AR_RETURNED_CHECK_FEE).toBe(30)
    expect(AR_RETURNED_CHECK_FEE_LINE).toBe('$30 — the most Texas allows, Bus. & Com. Code § 3.506')
    expect(AR_RETURNED_CHECK_FEE_STATUTE).toContain('§ 3.506(b), as amended by H.B. 2793 (2011)')
    expect(AR_RETURNED_CHECK_FEE_STATUTE).toContain('may charge the drawer or indorser a maximum processing fee of $30')
    expect(AR_RETURNED_CHECK_FEE_STATUTE).toContain('§ 3.506(c)')
    expect(AR_RETURNED_CHECK_FEE_STATUTE).toContain('art. 102.007(e)')
  })
})

describe('arCaseFeeOffer', () => {
  it('a check that came back offers the press on the bill it paid, with the line and the statute', () => {
    expect(arCaseFeeOffer(BANK, feeRow({}))).toEqual({ kind: 'offer', invoiceId: 'b1', button: 'Add the $30 fee to bill 1', line: AR_RETURNED_CHECK_FEE_LINE, title: AR_RETURNED_CHECK_FEE_STATUTE })
    expect(arCaseFeeOffer({ source: 'hand' }, feeRow({}))?.kind).toBe('offer')
  })

  it('names the oldest bill the check paid that is not a Stripe invoice, and the job when it paid bills on two', () => {
    const two = feeRow({ bills: [bill({ invoice_id: 'b3', sequence_order: 2 }), bill({ invoice_id: 'b1', sequence_order: 0, stripe: true }), bill({ invoice_id: 'b2', sequence_order: 1 })] })
    expect(arCaseFeeOffer(BANK, two)).toMatchObject({ kind: 'offer', invoiceId: 'b2', button: 'Add the $30 fee to bill 2' })
    const jobs = feeRow({ bills: [bill({ invoice_id: 'k1', job_id: 'j651', job_number: '651', sequence_order: 0 }), bill({ invoice_id: 'b2', sequence_order: 1 })] })
    expect(arCaseFeeOffer(BANK, jobs)).toMatchObject({ invoiceId: 'k1', button: 'Add the $30 fee to bill 1 on 651' })
  })

  it('a check that paid only Stripe bills says why there is no press; one that named no bill says so too', () => {
    expect(arCaseFeeOffer(BANK, feeRow({ bills: [bill({ sequence_order: 1, stripe: true })] }))).toMatchObject({ kind: 'blocked', words: 'Bill 2 is a Stripe invoice, and a sent Stripe invoice cannot take a line.' })
    expect(arCaseFeeOffer(BANK, feeRow({ bills: [] }))).toMatchObject({ kind: 'blocked', words: 'The check paid no bill by name, so the fee has no bill to go on.' })
  })

  it('once the fee is on, the case says where, when and who — and offers no second press', () => {
    const added = arCaseFeeOffer(BANK, feeRow({ fee_amount: 30, fee_invoice_id: 'b1', fee_added_at: '2026-10-09T15:00:00Z', fee_added_by: 'Taunya' }))
    expect(added).toEqual({ kind: 'added', words: 'The $30 fee is on bill 1, added Oct 9 by Taunya.', line: AR_RETURNED_CHECK_FEE_LINE, title: AR_RETURNED_CHECK_FEE_STATUTE })
  })

  it('is not the question for a check that never reached the bank, a Stripe case, or before the read comes back', () => {
    for (const source of ['rejected', 'unbanked', 'stripe_dispute', 'stripe_debit'] as const) expect(arCaseFeeOffer({ source }, feeRow({}))).toBeNull()
    expect(arCaseFeeOffer(BANK, null)).toBeNull()
  })
})

describe('the bill’s own fee lines (jobs_ledger_invoices.fee_lines)', () => {
  it('reads the lines a bill carries and nothing else', () => {
    expect(billFeeLines({ fee_lines: [{ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount: 30, case_id: 'tx' }, { description: '', amount: 5 }, { description: 'x', amount: 'nope' }] })).toEqual([
      { description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amountDollars: 30 },
    ])
    expect(billFeeLines({})).toEqual([])
    expect(billFeeLines(null)).toEqual([])
  })

  it('the reprinted bill shows the fee as its own row, inside the bill’s amount, not spread over the work', () => {
    const inv = { id: 'b1', job_id: 'j878', amount: 13710, status: 'billed', sequence_order: 0, billed_at: '2026-09-02T15:00:00Z', sent_to_customer_at: '2026-09-02T15:00:00Z', estimated_bill_date: null, stripe_invoice_memo: 'Rough-in and top-out', external_send_note: '', stripe_invoice_footer: null, fee_lines: [{ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount: 30 }] }
    const job = { id: 'j878', job_name: 'Take 5- Seguin', customer_name: 'Southern Post', hcp_number: '878', click_number: '', job_address: '1 Main St', revenue: 38655, payments_made: 0, last_work_date: '2026-08-20', fixtures: [], materials: [], payments: [], invoices: [inv], team_members: [] } as unknown as JobWithDetails
    const doc = buildPhysicalInvoiceDocumentForBilledInvoice(job, inv as never)!
    expect(doc.serviceLines[doc.serviceLines.length - 1]).toEqual({ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', qty: 1, unitPrice: 30, amount: 30 })
    expect(doc.serviceLines.slice(0, -1).reduce((t, l) => t + l.amount, 0)).toBeCloseTo(13680, 2)
  })
})

describe('riderFeeLineCents (v2.5113): a returned check fee and a GC card fee both ride', () => {
  const CHECK = { description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount: 30, case_id: 'tx-sp', added_at: '2026-10-09T15:00:00Z' }
  const CARD = (cardBill: unknown, amount: unknown) => ({ description: 'Credit card fee (3%)', amount, card_bill: cardBill, added_at: '2026-10-09T20:00:00Z' })

  it('sums the entries that name a case or a card bill', () => {
    expect(riderFeeLineCents([{ id: 'b1', fee_lines: [CARD('b1', 1_282.5)] }, { id: 'b2', fee_lines: [CHECK, CARD('b2', 370.37)] }])).toBe(168_287)
  })

  it('a returned check fee alone reads as returnedCheckFeeCents does, and a card fee is not a returned check fee', () => {
    expect(riderFeeLineCents([{ fee_lines: [CHECK] }])).toBe(returnedCheckFeeCents([{ fee_lines: [CHECK] }]))
    expect(returnedCheckFeeCents([{ fee_lines: [CARD('b1', 1_282.5)] }])).toBe(0)
  })

  it('an entry that names neither, or an empty or unreadable card bill, is not a rider', () => {
    expect(riderFeeLineCents([{ fee_lines: [CARD(null, 50), CARD('', 50), CARD('  ', 50), CARD(7, 50), { description: 'Some other fee', amount: 45 }] }])).toBe(0)
    expect(riderFeeLineCents([{ fee_lines: [CARD('b1', 'nope'), CARD('b1', 0), CARD('b1', -5)] }])).toBe(0)
  })
})

describe('riderFeeLineCents (v2.5129): a turnaway trip charge rides too', () => {
  const TRIP = (reason: unknown, amount: unknown) => ({ trip_charge: reason, amount })

  it('sums an entry that names its trip charge beside the other riders', () => {
    expect(riderFeeLineCents([{ fee_lines: [TRIP('client_not_home', 99)] }, { fee_lines: [TRIP('site_not_ready', '250.00')] }])).toBe(34_900)
    expect(
      riderFeeLineCents([{ fee_lines: [TRIP('client_not_home', 99), { description: 'Returned check fee', amount: 30, case_id: 'c1' }] }]),
    ).toBe(12_900)
  })

  it('a trip charge is not a returned check fee', () => {
    expect(returnedCheckFeeCents([{ fee_lines: [TRIP('client_not_home', 99)] }])).toBe(0)
  })

  it('an empty, blank or unreadable trip charge, or an amount that does not read above zero, is not a rider', () => {
    expect(riderFeeLineCents([{ fee_lines: [TRIP(null, 99), TRIP('', 99), TRIP('  ', 99), TRIP(1, 99)] }])).toBe(0)
    expect(riderFeeLineCents([{ fee_lines: [TRIP('client_not_home', 'nope'), TRIP('client_not_home', 0), TRIP('client_not_home', -5)] }])).toBe(0)
  })

  it('has no description, so the reprinted bill draws no row of its own for it', () => {
    expect(billFeeLines({ fee_lines: [TRIP('client_not_home', 99)] })).toEqual([])
  })
})

describe('returnedCheckFeeCents (v2.5091): the fees a job’s revenue keeps through a rewrite', () => {
  const FEE = (caseId: unknown, amount: unknown) => ({ description: 'Returned check fee (Tex. Bus. & Com. Code § 3.506)', amount, case_id: caseId, added_at: '2026-10-09T15:00:00Z' })

  it('sums every case’s fee line on every bill of the job', () => {
    expect(returnedCheckFeeCents([{ id: 'b1', fee_lines: [FEE('tx-sp', 30)] }])).toBe(3_000)
    expect(returnedCheckFeeCents([{ id: 'b1', fee_lines: [FEE('tx-1', 30), FEE('tx-2', 30)] }, { id: 'b2', fee_lines: [FEE('tx-3', 30)] }])).toBe(9_000)
  })

  it('a fee line that names no case is not a returned check fee', () => {
    expect(returnedCheckFeeCents([{ fee_lines: [FEE(null, 30), FEE('', 30), FEE('   ', 30), FEE(42, 30), { description: 'Some other fee', amount: 30 }] }])).toBe(0)
    expect(returnedCheckFeeCents([{ fee_lines: [FEE('tx-sp', 30), { description: 'Some other fee', amount: 45 }] }])).toBe(3_000)
  })

  it('an amount that does not read, or is not above zero, counts as nothing', () => {
    expect(returnedCheckFeeCents([{ fee_lines: [FEE('tx-1', 'nope'), FEE('tx-2', null), FEE('tx-3', 0), FEE('tx-4', -30), FEE('tx-5', Number.NaN), FEE('tx-6', '30')] }])).toBe(3_000)
  })

  it('a bill with no fee lines, or lines that are not a list, adds nothing', () => {
    expect(returnedCheckFeeCents([{ id: 'b1' }, { fee_lines: null }, { fee_lines: {} }, { fee_lines: [null, 'x', 7] }])).toBe(0)
    expect(returnedCheckFeeCents([])).toBe(0)
    expect(returnedCheckFeeCents(null)).toBe(0)
    expect(returnedCheckFeeCents(undefined)).toBe(0)
  })

  it('counts in cents, so odd amounts never drift', () => {
    expect(returnedCheckFeeCents([{ fee_lines: [FEE('tx-1', 0.1), FEE('tx-2', 0.2)] }])).toBe(30)
    expect(returnedCheckFeeCents([{ fee_lines: [FEE('tx-1', 30.1)] }, { fee_lines: [FEE('tx-2', 30.2)] }])).toBe(6_030)
  })
})
