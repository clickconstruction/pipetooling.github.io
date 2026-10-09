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
