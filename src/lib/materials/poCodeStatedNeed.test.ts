import { describe, expect, it } from 'vitest'
import { poCodeSummaryLine, STATED_NEED_COLUMN, STATED_NEED_LABEL } from './poCodeStatedNeed'

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
