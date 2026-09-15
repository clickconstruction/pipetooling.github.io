import { describe, expect, it } from 'vitest'
import {
  addAllocation,
  allocationTotal,
  dueDateHint,
  invoiceSaveLabel,
  ordinalDay,
  paidAtIsoFromYmd,
  paidAtPayload,
  paidOnYmdFromIso,
  poCodeHint,
  poCodeHintText,
  removeAllocation,
  setAllocationPct,
} from './supplyHouseInvoiceForm'

describe('poCodeHint', () => {
  const ledger = new Set([41207, 55000])
  it('says nothing for an empty field', () => {
    expect(poCodeHint('', ledger)).toEqual({ kind: 'empty' })
    expect(poCodeHint('   ', ledger)).toEqual({ kind: 'empty' })
  })
  it('a hand PO has no five-digit code', () => {
    expect(poCodeHint('SpaceX', ledger)).toEqual({ kind: 'hand' })
    expect(poCodeHint('PO-1234', ledger)).toEqual({ kind: 'hand' })
  })
  it('a code on the ledger for this house', () => {
    expect(poCodeHint('41207', ledger)).toEqual({ kind: 'on_ledger', code: 41207 })
    expect(poCodeHint('PO 55000 rough-in', ledger)).toEqual({ kind: 'on_ledger', code: 55000 })
  })
  it('a code the house ledger does not carry', () => {
    expect(poCodeHint('41208', ledger)).toEqual({ kind: 'not_on_ledger', code: 41208 })
  })
  it('stays quiet while the ledger has not loaded', () => {
    expect(poCodeHint('41207', null)).toEqual({ kind: 'unknown', code: 41207 })
    expect(poCodeHintText({ kind: 'unknown', code: 41207 }, 'Ferguson')).toBeNull()
  })
  it('hint copy names the house', () => {
    expect(poCodeHintText({ kind: 'on_ledger', code: 41207 }, 'Ferguson')).toBe('PO 41207 is on the PO Generator ledger for Ferguson.')
    expect(poCodeHintText({ kind: 'not_on_ledger', code: 41208 }, 'Ferguson')).toMatch(/not on the PO Generator ledger for Ferguson/)
    expect(poCodeHintText({ kind: 'hand' }, 'Ferguson')).toMatch(/^Hand PO/)
    expect(poCodeHintText({ kind: 'empty' }, 'Ferguson')).toBeNull()
  })
})

describe('ordinalDay / dueDateHint', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 31].map(ordinalDay)).toEqual([
      '1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ])
  })
  it('names the house and its day', () => {
    expect(dueDateHint('National Wholesale', 10)).toBe("National Wholesale's payment day is the 10th.")
  })
  it('nothing when the house has no payment day', () => {
    expect(dueDateHint('Ferguson', null)).toBeNull()
    expect(dueDateHint('Ferguson', undefined)).toBeNull()
    expect(dueDateHint('Ferguson', 0)).toBeNull()
    expect(dueDateHint('Ferguson', 32)).toBeNull()
  })
})

describe('paid on ↔ paid_at', () => {
  it('a day round-trips through company noon', () => {
    const iso = paidAtIsoFromYmd('2026-09-14')
    expect(iso).not.toBeNull()
    // Noon Central in September is 17:00Z.
    expect(iso).toBe('2026-09-14T17:00:00.000Z')
    expect(paidOnYmdFromIso(iso)).toBe('2026-09-14')
  })
  it('a stored instant late in the evening still reads as its Central day', () => {
    // 11:30 PM Central on the 14th is 04:30Z on the 15th.
    expect(paidOnYmdFromIso('2026-09-15T04:30:00.000Z')).toBe('2026-09-14')
  })
  it('blank or malformed → null / empty', () => {
    expect(paidAtIsoFromYmd('')).toBeNull()
    expect(paidAtIsoFromYmd('nope')).toBeNull()
    expect(paidOnYmdFromIso(null)).toBe('')
    expect(paidOnYmdFromIso(undefined)).toBe('')
  })
  it('payload: unpaid says nothing (the trigger nulls paid_at)', () => {
    expect(paidAtPayload(false, '2026-09-14', null)).toEqual({})
  })
  it('payload: paid with no day says nothing (the trigger stamps now)', () => {
    expect(paidAtPayload(true, '', null)).toEqual({})
  })
  it('payload: paid with a day sends company noon', () => {
    expect(paidAtPayload(true, '2026-09-14', null)).toEqual({ paid_at: '2026-09-14T17:00:00.000Z' })
  })
  it('payload: the same day as stored is left alone (no drift to noon)', () => {
    expect(paidAtPayload(true, '2026-09-14', '2026-09-14T20:11:00.000Z')).toEqual({})
  })
  it('payload: a different day than stored is sent', () => {
    expect(paidAtPayload(true, '2026-09-12', '2026-09-14T20:11:00.000Z')).toEqual({ paid_at: '2026-09-12T17:00:00.000Z' })
  })
})

describe('allocations', () => {
  it('first job takes 100', () => {
    expect(addAllocation([], 'a')).toEqual([{ job_id: 'a', pct: 100 }])
  })
  it('adding re-splits evenly; the last absorbs rounding', () => {
    const two = addAllocation([{ job_id: 'a', pct: 100 }], 'b')
    expect(two).toEqual([{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }])
    const three = addAllocation(two, 'c')
    expect(three.map((a) => a.pct)).toEqual([33.3, 33.3, 33.4])
    expect(allocationTotal(three)).toBe(100)
  })
  it('a job already on the invoice is a no-op (same reference)', () => {
    const list = [{ job_id: 'a', pct: 100 }]
    expect(addAllocation(list, 'a')).toBe(list)
  })
  it('removing re-splits the rest; removing the last empties', () => {
    const three = [{ job_id: 'a', pct: 33.3 }, { job_id: 'b', pct: 33.3 }, { job_id: 'c', pct: 33.4 }]
    expect(removeAllocation(three, 1)).toEqual([{ job_id: 'a', pct: 50 }, { job_id: 'c', pct: 50 }])
    expect(removeAllocation([{ job_id: 'a', pct: 100 }], 0)).toEqual([])
  })
  it('setting one percent scales the others to keep 100', () => {
    const two = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }]
    expect(setAllocationPct(two, 0, 70)).toEqual([{ job_id: 'a', pct: 70 }, { job_id: 'b', pct: 30 }])
    const three = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 25 }, { job_id: 'c', pct: 25 }]
    const next = setAllocationPct(three, 0, 80)
    expect(next[0]?.pct).toBe(80)
    expect(allocationTotal(next)).toBe(100)
  })
  it('clamps to 0–100 and treats NaN as 0', () => {
    const two = [{ job_id: 'a', pct: 50 }, { job_id: 'b', pct: 50 }]
    expect(setAllocationPct(two, 0, 150)).toEqual([{ job_id: 'a', pct: 100 }, { job_id: 'b', pct: 0 }])
    expect(setAllocationPct(two, 0, Number.NaN)).toEqual([{ job_id: 'a', pct: 0 }, { job_id: 'b', pct: 100 }])
  })
  it('when every other job is at 0, the remainder is handed out evenly', () => {
    const three = [{ job_id: 'a', pct: 100 }, { job_id: 'b', pct: 0 }, { job_id: 'c', pct: 0 }]
    expect(setAllocationPct(three, 0, 40)).toEqual([{ job_id: 'a', pct: 40 }, { job_id: 'b', pct: 30 }, { job_id: 'c', pct: 30 }])
  })
  it('editing the last job pushes rounding onto its neighbour, not itself', () => {
    const three = [{ job_id: 'a', pct: 33.3 }, { job_id: 'b', pct: 33.3 }, { job_id: 'c', pct: 33.4 }]
    const next = setAllocationPct(three, 2, 50)
    expect(next[2]?.pct).toBe(50)
    expect(allocationTotal(next)).toBe(100)
  })
})

describe('invoiceSaveLabel', () => {
  it('names the action', () => {
    expect(invoiceSaveLabel(false, false)).toBe('Save invoice')
    expect(invoiceSaveLabel(true, false)).toBe('Save changes')
    expect(invoiceSaveLabel(true, true)).toBe('Saving…')
  })
})
