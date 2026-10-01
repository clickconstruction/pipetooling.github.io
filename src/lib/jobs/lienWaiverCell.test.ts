import { describe, expect, it } from 'vitest'
import { billSettled, lienWaiverCellForBill } from './lienWaiverCell'
import type { JobLienReleaseRow } from './lienReleaseTracking'

function rel(over: Partial<JobLienReleaseRow> & { id: string; form_type: string; invoice_ids: string[] }): JobLienReleaseRow {
  return {
    amount: 1000,
    created_at: '2026-09-30T15:00:00Z',
    created_by: null,
    fields: {},
    job_id: 'j',
    minted_at: null,
    minted_pdf_path: null,
    sent_by: null,
    sent_channel: null,
    sent_to_customer_at: null,
    signature_requested_at: null,
    signature_requested_by: null,
    signed_at: null,
    signed_date: null,
    signed_on_device_of: null,
    signed_pdf_path: null,
    signer_consented_at: null,
    signer_printed_name: null,
    signer_signature_mode: null,
    signer_signature_storage_path: null,
    signer_user_id: null,
    status: 'draft',
    through_date: null,
    voided_at: null,
    voided_by: null,
    ...over,
  } as JobLienReleaseRow
}

describe('lienWaiverCellForBill (v2.4275)', () => {
  it('a bill with nothing yet: the conditional is owed while the money is out, the unconditional waits for it', () => {
    const cell = lienWaiverCellForBill([], 'inv-1', false)
    expect(cell.next).toBe('add_conditional')
    expect(cell.chips.map((c) => c.text)).toEqual(['Conditional · none — send it', 'Unconditional · when paid'])
    expect(cell.chips.map((c) => c.tone)).toEqual(['amber', 'grey'])
  })
  it('a sent conditional and an open bill: nothing owed; once settled, the unconditional is', () => {
    const rows = [rel({ id: 'c', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-30T16:00:00Z', sent_to_customer_at: '2026-09-30T16:05:00Z' })]
    const open = lienWaiverCellForBill(rows, 'inv-1', false)
    expect(open.conditional.state).toBe('sent')
    expect(open.next).toBeNull()
    expect(open.chips[0]!.text).toBe('Conditional ✓ sent Sep 30')
    const settled = lienWaiverCellForBill(rows, 'inv-1', true)
    expect(settled.next).toBe('add_unconditional')
    expect(settled.chips[1]!.text).toBe('Unconditional owed · settled')
  })
  it('an awaiting release asks to be signed; a signed one to be sent; a voided one is ignored; another bill’s rows are not mine', () => {
    const awaiting = rel({ id: 'a', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'awaiting_signature', signature_requested_at: '2026-09-29T10:00:00Z' })
    expect(lienWaiverCellForBill([awaiting], 'inv-1', false)).toMatchObject({ next: 'sign', conditional: { state: 'awaiting', ymd: '2026-09-29' } })
    const signed = rel({ id: 's', form_type: 'conditional_final', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-30T10:00:00Z' })
    expect(lienWaiverCellForBill([signed], 'inv-1', false)).toMatchObject({ next: 'send', chips: [{ text: 'Conditional ✓ signed · send it' }, { text: 'Unconditional · when paid' }] })
    const voided = rel({ id: 'v', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'signed', voided_at: '2026-09-30T11:00:00Z' })
    expect(lienWaiverCellForBill([voided], 'inv-1', false).conditional.state).toBe('none')
    expect(lienWaiverCellForBill([signed], 'inv-2', false).conditional.state).toBe('none')
  })
  it('the newest and furthest-along row decides a half; both halves done reads all green', () => {
    const rows = [
      rel({ id: 'c1', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'issued', created_at: '2026-09-01T10:00:00Z', minted_at: '2026-09-01T10:00:00Z' }),
      rel({ id: 'c2', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-02T10:00:00Z', sent_to_customer_at: '2026-09-02T10:10:00Z', created_at: '2026-09-02T10:00:00Z' }),
      rel({ id: 'u', form_type: 'unconditional_progress', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-20T10:00:00Z', sent_to_customer_at: '2026-09-20T10:10:00Z', created_at: '2026-09-20T10:00:00Z' }),
    ]
    const cell = lienWaiverCellForBill(rows, 'inv-1', true)
    expect(cell.conditional.release?.id).toBe('c2')
    expect(cell.unconditional.state).toBe('sent')
    expect(cell.next).toBeNull()
    expect(cell.chips.every((c) => c.tone === 'green')).toBe(true)
  })
  it('billSettled: payments on the bill reach its amount', () => {
    expect(billSettled({ id: 'a', amount: 100 }, [{ invoice_id: 'a', amount: 60 }, { invoice_id: 'a', amount: 40 }])).toBe(true)
    expect(billSettled({ id: 'a', amount: 100 }, [{ invoice_id: 'a', amount: 60 }, { invoice_id: 'b', amount: 40 }])).toBe(false)
    expect(billSettled({ id: 'a', amount: 0 }, [])).toBe(false)
  })
  it('billSettled (v2.4318): a bill marked paid is settled though its payments name no bill (job 251)', () => {
    expect(billSettled({ id: 'a', amount: 9440, status: 'paid' }, [{ invoice_id: null, amount: 9440 }])).toBe(true)
    expect(billSettled({ id: 'a', amount: 9440, status: 'billed' }, [{ invoice_id: null, amount: 9440 }])).toBe(false)
    expect(lienWaiverCellForBill([], 'a', billSettled({ id: 'a', amount: 9440, status: 'paid' }, [])).next).toBe('add_unconditional')
  })
})

describe('lienWaiverCellForBill — calm, the Bill tab (v2.4309)', () => {
  const sentConditional = rel({ id: 'c', form_type: 'conditional_progress', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-30T16:00:00Z', sent_to_customer_at: '2026-09-30T16:05:00Z' })

  it('a bill with no waiver started stays grey, open or settled, and still offers to add one', () => {
    const open = lienWaiverCellForBill([], 'inv-1', false, { calm: true })
    expect(open.chips.map((c) => [c.text, c.tone])).toEqual([
      ['Conditional · not added', 'grey'],
      ['Unconditional · when paid', 'grey'],
    ])
    expect([open.next, open.underWay, open.nextIsOwed]).toEqual(['add_conditional', false, false])
    const settled = lienWaiverCellForBill([], 'inv-1', true, { calm: true })
    expect(settled.chips.map((c) => [c.text, c.tone])).toEqual([
      ['Conditional · not added', 'grey'],
      ['Unconditional · not added', 'grey'],
    ])
    expect([settled.next, settled.nextIsOwed]).toEqual(['add_unconditional', false])
  })

  it('a waiver under way keeps its amber: signed and not sent, or the unconditional owed after a sent conditional', () => {
    const signed = rel({ id: 's', form_type: 'conditional_final', invoice_ids: ['inv-1'], status: 'signed', signed_at: '2026-09-30T10:00:00Z' })
    const cell = lienWaiverCellForBill([signed], 'inv-1', false, { calm: true })
    expect(cell.chips[0]).toEqual({ half: 'conditional', text: 'Conditional ✓ signed · send it', tone: 'amber' })
    expect([cell.next, cell.underWay, cell.nextIsOwed]).toEqual(['send', true, true])
    const owed = lienWaiverCellForBill([sentConditional], 'inv-1', true, { calm: true })
    expect(owed.chips[1]).toEqual({ half: 'unconditional', text: 'Unconditional owed · settled', tone: 'amber' })
    expect([owed.next, owed.nextIsOwed]).toEqual(['add_unconditional', true])
  })

  it('GC Review keeps the move before the call: without calm, an open bill with no conditional reads amber', () => {
    expect(lienWaiverCellForBill([], 'inv-1', false).chips[0]).toEqual({ half: 'conditional', text: 'Conditional · none — send it', tone: 'amber' })
    expect(lienWaiverCellForBill([], 'inv-1', false).nextIsOwed).toBe(false)
  })
})
