import { describe, expect, it } from 'vitest'
import { parseOverheadAllocationSetting, serializeOverheadAllocationSetting } from './overheadAllocationSettings'
import { OVERHEAD_ALLOCATION_LEGACY, OVERHEAD_ALLOCATION_RECOMMENDED } from './overheadAllocation'

describe('overhead allocation app setting', () => {
  it('absent, blank or junk reads as the original day-share', () => {
    expect(parseOverheadAllocationSetting(null)).toEqual(OVERHEAD_ALLOCATION_LEGACY)
    expect(parseOverheadAllocationSetting(undefined)).toEqual(OVERHEAD_ALLOCATION_LEGACY)
    expect(parseOverheadAllocationSetting('   ')).toEqual(OVERHEAD_ALLOCATION_LEGACY)
    expect(parseOverheadAllocationSetting('{not json')).toEqual(OVERHEAD_ALLOCATION_LEGACY)
  })
  it('round-trips the recommendation and clamps on the way out', () => {
    const text = serializeOverheadAllocationSetting(OVERHEAD_ALLOCATION_RECOMMENDED)
    expect(JSON.parse(text)).toEqual({ smoothDays: 30, carryShare: 0.2, idleCapDays: 14, openDef: 'status' })
    expect(parseOverheadAllocationSetting(text)).toEqual(OVERHEAD_ALLOCATION_RECOMMENDED)
    expect(JSON.parse(serializeOverheadAllocationSetting({ smoothDays: 400, carryShare: 2, idleCapDays: null, openDef: 'worked' }))).toEqual({ smoothDays: 60, carryShare: 1, idleCapDays: null, openDef: 'worked' })
  })
  it('reads a partial row field by field (a future field added later does not break an older client)', () => {
    expect(parseOverheadAllocationSetting('{"smoothDays":14,"someFutureField":true}')).toEqual({ smoothDays: 14, carryShare: 0, idleCapDays: null, openDef: 'status' })
  })
})
