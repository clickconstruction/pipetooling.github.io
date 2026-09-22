import { describe, expect, it } from 'vitest'
import { normalizeStatedNeed, poCodeSummaryLine, STATED_NEED_ADD_LINK, STATED_NEED_ASK_AFTER, STATED_NEED_COLUMN, STATED_NEED_LABEL, STATED_NEED_SAVE_LABEL, withStatedNeed } from './poCodeStatedNeed'

describe('poCodeSummaryLine', () => {
  const base = { code: 48213, supplyHouseName: 'Ferguson', jobLabel: 'J964 · Oak Ridge townhomes', personName: 'Marcus Delgado' }
  it('carries the claim last', () => {
    expect(poCodeSummaryLine({ ...base, statedNeed: '40 ft of ¾" PEX and two stop valves' })).toBe(
      'PO 48213 — Ferguson — J964 · Oak Ridge townhomes — for Marcus Delgado — 40 ft of ¾" PEX and two stop valves',
    )
  })
  it('reads exactly as before when nothing was written down', () => {
    expect(poCodeSummaryLine({ ...base, statedNeed: null })).toBe('PO 48213 — Ferguson — J964 · Oak Ridge townhomes — for Marcus Delgado')
    expect(poCodeSummaryLine({ ...base, statedNeed: '   ' })).toBe('PO 48213 — Ferguson — J964 · Oak Ridge townhomes — for Marcus Delgado')
  })
  it('no supply house — the house segment is skipped, the claim still lands', () => {
    expect(poCodeSummaryLine({ ...base, supplyHouseName: null, statedNeed: 'trim' })).toBe('PO 48213 — J964 · Oak Ridge townhomes — for Marcus Delgado — trim')
  })
  it('the two labels are the wording the guides quote', () => {
    expect(STATED_NEED_LABEL).toBe('What they said they need')
    expect(STATED_NEED_COLUMN).toBe('Said they need')
  })
})

describe('normalizeStatedNeed (v2.3718)', () => {
  it('trims, and blank is null — the same shape the RPC stores', () => {
    expect(normalizeStatedNeed('  40 ft of ¾" PEX  ')).toBe('40 ft of ¾" PEX')
    expect(normalizeStatedNeed('   ')).toBeNull()
    expect(normalizeStatedNeed(null)).toBeNull()
    expect(normalizeStatedNeed(undefined)).toBeNull()
  })
})

describe('withStatedNeed (v2.3718)', () => {
  const rows = [
    { id: 'a', notes: null, po_code: 14233 },
    { id: 'b', notes: 'trim', po_code: 31877 },
  ]
  it('writes the claim on the one row and keeps the order', () => {
    const out = withStatedNeed(rows, 'a', ' two tubes ')
    expect(out.map((r) => r.po_code)).toEqual([14233, 31877])
    expect(out[0]).toEqual({ id: 'a', notes: 'two tubes', po_code: 14233 })
    expect(out[1]).toBe(rows[1])
  })
  it('a blank clears the claim; an unknown id changes nothing', () => {
    expect(withStatedNeed(rows, 'b', '  ')[1]?.notes).toBeNull()
    expect(withStatedNeed(rows, 'zzz', 'x')).toEqual(rows)
  })
  it('the after-mint wording is what the guides quote', () => {
    expect(STATED_NEED_ASK_AFTER).toBe('What did they say they need?')
    expect(STATED_NEED_ADD_LINK).toBe('add what it was for…')
    expect(STATED_NEED_SAVE_LABEL).toBe('Write it down')
  })
})
