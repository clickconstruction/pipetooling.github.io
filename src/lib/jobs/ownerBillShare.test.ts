import { describe, expect, it } from 'vitest'
import { ownerShareApplies, ownerShareChipWords, ownerSharePropertyState, ownerShareScope, ownerShareState, ownerShareWrites, type OwnerShareInvoice, type OwnerShareJob } from './ownerBillShare'

// 9703 Lenox Hl on 2026-09-25: Umar Khan is the customer, RMC- Dudley Mason the GC and the payer.
const LENOX = 'addr-lenox'
const job = (id: string, over: Partial<OwnerShareJob> = {}): OwnerShareJob => ({ id, customer_id: 'umar', gc_customer_id: 'rmc', bill_to_party: 'gc', customer_address_id: LENOX, show_bills_to_other_party: false, ...over })
const bill = (id: string, jobId: string, over: Partial<OwnerShareInvoice> = {}): OwnerShareInvoice => ({ id, job_id: jobId, status: 'billed', bill_to_party: null, bill_to_email: null, shown_to_party: null, ...over })

describe('ownerShareApplies', () => {
  it('a GC-billed job whose customer is someone else — the owner', () => {
    expect(ownerShareApplies(job('j273'))).toBe(true)
  })
  it('not when the customer pays, when there is no GC, or when the GC is the customer row', () => {
    expect(ownerShareApplies(job('a', { bill_to_party: 'customer' }))).toBe(false)
    expect(ownerShareApplies(job('b', { gc_customer_id: null }))).toBe(false)
    expect(ownerShareApplies(job('c', { customer_id: 'rmc' }))).toBe(false)
  })
})

describe('ownerShareState', () => {
  const j = job('j273')
  it('off today: no memory, no stamp — their portal reads $0', () => {
    expect(ownerShareState(j, [bill('i1', 'j273'), bill('i2', 'j273')])).toBe('off')
    expect(ownerShareChipWords('off')).toBe('owner sees $0')
  })
  it('on: the memory and every open GC bill stamped for them', () => {
    expect(ownerShareState({ ...j, show_bills_to_other_party: true }, [bill('i1', 'j273', { shown_to_party: 'customer' })])).toBe('on')
  })
  it('partly: the old next-bills-only tick from Edit Job, or one bill ticked by hand', () => {
    expect(ownerShareState({ ...j, show_bills_to_other_party: true }, [bill('i1', 'j273')])).toBe('partly')
    expect(ownerShareState(j, [bill('i1', 'j273', { shown_to_party: 'customer' }), bill('i2', 'j273')])).toBe('partly')
  })
  it('only open bills the GC pays count — a paid bill and a bill sent to a typed address do not', () => {
    expect(ownerShareState(j, [bill('p', 'j273', { status: 'paid' }), bill('x', 'j273', { bill_to_email: 'someone@else.test' })])).toBe('off')
  })
  it('null where the switch does not apply', () => {
    expect(ownerShareState(job('a', { bill_to_party: 'customer' }), [])).toBeNull()
  })
})

describe('the whole property (the owner, 2026-09-25)', () => {
  const lenox = [job('j273'), job('j858'), job('j866'), job('j881'), job('j1009')]
  const elsewhere = job('j500', { customer_address_id: 'addr-other' })
  const someoneElse = job('j600', { customer_id: 'rizvi' })
  it('one flip covers every job at the saved property with the same owner', () => {
    expect(ownerShareScope(lenox[0]!, [...lenox, elsewhere, someoneElse]).map((j) => j.id)).toEqual(['j273', 'j858', 'j866', 'j881', 'j1009'])
  })
  it('a job with no saved property is alone', () => {
    const loose = job('j258', { customer_address_id: null })
    expect(ownerShareScope(loose, [loose, ...lenox]).map((j) => j.id)).toEqual(['j258'])
  })
  it('the property reads on only when every job is on', () => {
    expect(ownerSharePropertyState(['on', 'on'])).toBe('on')
    expect(ownerSharePropertyState(['off', 'off', null])).toBe('off')
    expect(ownerSharePropertyState(['on', 'off'])).toBe('partly')
    expect(ownerSharePropertyState([null])).toBeNull()
  })
})

describe('ownerShareWrites', () => {
  const jobs = [job('j273'), job('j858', { show_bills_to_other_party: true }), job('j999', { bill_to_party: 'customer' })]
  const invoices = [
    bill('a', 'j273'),
    bill('b', 'j273', { shown_to_party: 'customer' }),
    bill('c', 'j858'),
    bill('paid', 'j858', { status: 'paid' }),
    bill('gcTick', 'j273', { shown_to_party: 'gc' }),
    bill('own', 'j999'),
  ]
  it('on: every applicable job remembers it; every open GC bill not yet stamped is stamped', () => {
    expect(ownerShareWrites(jobs, invoices, true)).toEqual({ jobIds: ['j273', 'j858'], invoiceIds: ['a', 'gcTick', 'c'], on: true })
  })
  it('off: only the owner’s stamps are cleared, open bills only — a paid bill they saw stays in their history', () => {
    expect(ownerShareWrites(jobs, invoices, false)).toEqual({ jobIds: ['j273', 'j858'], invoiceIds: ['b'], on: false })
  })
})
