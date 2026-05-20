import { describe, expect, it } from 'vitest'
import {
  planInsertStageAfter,
  type ForecastInsertStageInput,
} from './projectsForecastInsertStage'

const TODAY = '2026-05-25'

function s(
  id: string,
  order: number,
  start: string,
  end: string,
  status: string | null = 'pending',
): ForecastInsertStageInput {
  return { stageId: id, sequenceOrder: order, startYmd: start, endYmd: end, status }
}

describe('planInsertStageAfter — empty workflow', () => {
  it('inserts at sequence 1 with todayYmd as the anchor when there are no stages', () => {
    const plan = planInsertStageAfter({ stages: [], afterStageId: null, todayYmd: TODAY })
    expect(plan.newRow).toEqual({
      sequenceOrder: 1,
      startYmd: TODAY,
      endYmd: TODAY,
    })
    expect(plan.sequenceOrderBumps).toEqual([])
    expect(plan.shiftedOverrides.size).toBe(0)
    expect(plan.skippedHistoricalCount).toBe(0)
  })

  it('respects a custom length on an empty workflow', () => {
    const plan = planInsertStageAfter({
      stages: [],
      afterStageId: null,
      todayYmd: TODAY,
      lengthDays: 5,
    })
    expect(plan.newRow).toEqual({
      sequenceOrder: 1,
      startYmd: TODAY,
      endYmd: '2026-05-29',
    })
  })
})

describe('planInsertStageAfter — insert at start (afterStageId === null)', () => {
  it('bumps every existing sequence_order by 1 and shifts every pending stage forward by 1 day', () => {
    const stages = [
      s('a', 3, '2026-05-25', '2026-05-26'),
      s('b', 5, '2026-05-27', '2026-05-28'),
      s('c', 7, '2026-05-29', '2026-05-30'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: null, todayYmd: TODAY })
    expect(plan.newRow.sequenceOrder).toBe(1)
    expect(plan.newRow.startYmd).toBe(TODAY)
    expect(plan.newRow.endYmd).toBe(TODAY)
    // Bumps sorted DESC by current order
    expect(plan.sequenceOrderBumps).toEqual([
      { stageId: 'c', from: 7, to: 8 },
      { stageId: 'b', from: 5, to: 6 },
      { stageId: 'a', from: 3, to: 4 },
    ])
    // Every pending stage's dates shift by exactly the new stage's length (1 day)
    expect(plan.shiftedOverrides.get('a')).toEqual({ startYmd: '2026-05-26', endYmd: '2026-05-27' })
    expect(plan.shiftedOverrides.get('b')).toEqual({ startYmd: '2026-05-28', endYmd: '2026-05-29' })
    expect(plan.shiftedOverrides.get('c')).toEqual({ startYmd: '2026-05-30', endYmd: '2026-05-31' })
    expect(plan.skippedHistoricalCount).toBe(0)
  })

  it('shifts every pending stage by N days for a length-N insert at start', () => {
    const stages = [
      s('a', 1, '2026-05-25', '2026-05-25'),
      s('b', 2, '2026-05-26', '2026-05-30'),
    ]
    const plan = planInsertStageAfter({
      stages,
      afterStageId: null,
      todayYmd: TODAY,
      lengthDays: 7,
    })
    expect(plan.newRow.endYmd).toBe('2026-05-31') // 25 + (7-1)
    expect(plan.shiftedOverrides.get('a')).toEqual({ startYmd: '2026-06-01', endYmd: '2026-06-01' })
    expect(plan.shiftedOverrides.get('b')).toEqual({ startYmd: '2026-06-02', endYmd: '2026-06-06' })
  })
})

describe('planInsertStageAfter — insert in the middle', () => {
  it('starts on the day AFTER the chosen stage end (next_day chain) and only cascades later stages', () => {
    const stages = [
      s('a', 1, '2026-05-25', '2026-05-26'),
      s('b', 2, '2026-05-27', '2026-05-28'),
      s('c', 3, '2026-05-29', '2026-05-30'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'b', todayYmd: TODAY, lengthDays: 1 })
    expect(plan.newRow.sequenceOrder).toBe(3) // after 'b' (order 2)
    expect(plan.newRow.startYmd).toBe('2026-05-29') // b.endYmd + 1
    expect(plan.newRow.endYmd).toBe('2026-05-29')
    // 'a' is untouched (earlier in sequence)
    expect(plan.shiftedOverrides.has('a')).toBe(false)
    expect(plan.sequenceOrderBumps.find((b) => b.stageId === 'a')).toBeUndefined()
    // 'c' bumped and shifted by 1 day
    expect(plan.sequenceOrderBumps).toEqual([{ stageId: 'c', from: 3, to: 4 }])
    expect(plan.shiftedOverrides.get('c')).toEqual({ startYmd: '2026-05-30', endYmd: '2026-05-31' })
  })

  it('preserves gaps between later stages when cascading by N days', () => {
    const stages = [
      s('a', 1, '2026-05-25', '2026-05-26'),
      s('b', 2, '2026-05-30', '2026-06-02'), // 3-day gap after 'a'
      s('c', 3, '2026-06-10', '2026-06-12'), // 7-day gap after 'b'
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'a', todayYmd: TODAY, lengthDays: 3 })
    expect(plan.newRow.startYmd).toBe('2026-05-27') // a.endYmd + 1
    expect(plan.newRow.endYmd).toBe('2026-05-29') // 27 + (3-1)
    // 'b' shifts +3 days; gap from new stage's end (29) to b's new start (30+3=06-02) preserved
    expect(plan.shiftedOverrides.get('b')).toEqual({ startYmd: '2026-06-02', endYmd: '2026-06-05' })
    // 'c' shifts +3 days
    expect(plan.shiftedOverrides.get('c')).toEqual({ startYmd: '2026-06-13', endYmd: '2026-06-15' })
  })
})

describe('planInsertStageAfter — sparse sequence orders', () => {
  it('uses after.sequence_order + 1 for the new row (does not invent midpoint floats)', () => {
    const stages = [
      s('a', 3, '2026-05-25', '2026-05-26'),
      s('b', 7, '2026-05-29', '2026-05-30'),
      s('c', 16, '2026-06-02', '2026-06-04'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'a', todayYmd: TODAY })
    expect(plan.newRow.sequenceOrder).toBe(4) // after 'a' (order 3)
    // Both later stages bump because their orders are > 3
    expect(plan.sequenceOrderBumps).toEqual([
      { stageId: 'c', from: 16, to: 17 },
      { stageId: 'b', from: 7, to: 8 },
    ])
  })

  it('handles inserting at the very last stage cleanly', () => {
    const stages = [
      s('a', 3, '2026-05-25', '2026-05-26'),
      s('b', 7, '2026-05-29', '2026-05-30'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'b', todayYmd: TODAY, lengthDays: 2 })
    expect(plan.newRow.sequenceOrder).toBe(8) // 7 + 1
    expect(plan.newRow.startYmd).toBe('2026-05-31')
    expect(plan.newRow.endYmd).toBe('2026-06-01')
    expect(plan.sequenceOrderBumps).toEqual([])
    expect(plan.shiftedOverrides.size).toBe(0)
  })
})

describe('planInsertStageAfter — historical stage handling', () => {
  it('bumps sequence_order for historical stages in the cascade but leaves their dates alone', () => {
    const stages = [
      s('a', 1, '2026-05-20', '2026-05-22', 'completed'),
      s('b', 2, '2026-05-25', '2026-05-26', 'pending'),
      s('c', 3, '2026-05-27', '2026-05-29', 'approved'),
      s('d', 4, '2026-06-01', '2026-06-03', 'in_progress'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'b', todayYmd: TODAY, lengthDays: 2 })
    // Cascade window is c + d (orders > 2)
    expect(plan.sequenceOrderBumps).toEqual([
      { stageId: 'd', from: 4, to: 5 },
      { stageId: 'c', from: 3, to: 4 },
    ])
    // 'c' (approved) skipped; 'd' (in_progress) shifted +2 days
    expect(plan.shiftedOverrides.has('c')).toBe(false)
    expect(plan.shiftedOverrides.get('d')).toEqual({ startYmd: '2026-06-03', endYmd: '2026-06-05' })
    expect(plan.skippedHistoricalCount).toBe(1)
  })

  it('treats skipped status as historical too', () => {
    const stages = [
      s('a', 1, '2026-05-25', '2026-05-26'),
      s('b', 2, '2026-05-27', '2026-05-28', 'skipped'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'a', todayYmd: TODAY })
    expect(plan.shiftedOverrides.has('b')).toBe(false)
    expect(plan.skippedHistoricalCount).toBe(1)
  })
})

describe('planInsertStageAfter — defensive paths', () => {
  it('clamps lengthDays below 1 to 1', () => {
    const plan = planInsertStageAfter({
      stages: [],
      afterStageId: null,
      todayYmd: TODAY,
      lengthDays: 0,
    })
    expect(plan.newRow.startYmd).toBe(plan.newRow.endYmd)
  })

  it('treats non-finite lengthDays as 1', () => {
    const plan = planInsertStageAfter({
      stages: [],
      afterStageId: null,
      todayYmd: TODAY,
      lengthDays: Number.NaN,
    })
    expect(plan.newRow.startYmd).toBe(plan.newRow.endYmd)
  })

  it('falls back to a no-cascade end-of-workflow insert when afterStageId is unknown', () => {
    const stages = [s('a', 3, '2026-05-25', '2026-05-26'), s('b', 7, '2026-05-29', '2026-05-30')]
    const plan = planInsertStageAfter({
      stages,
      afterStageId: 'does-not-exist',
      todayYmd: TODAY,
    })
    expect(plan.newRow.sequenceOrder).toBe(8) // max + 1
    expect(plan.newRow.startYmd).toBe(TODAY)
    expect(plan.sequenceOrderBumps).toEqual([])
    expect(plan.shiftedOverrides.size).toBe(0)
  })

  it('omits malformed-date stages from the shift map but still bumps their sequence_order', () => {
    const stages = [
      s('a', 1, '2026-05-25', '2026-05-26'),
      s('b', 2, 'bad', 'also-bad'),
      s('c', 3, '2026-05-29', '2026-05-30'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'a', todayYmd: TODAY })
    expect(plan.sequenceOrderBumps).toEqual([
      { stageId: 'c', from: 3, to: 4 },
      { stageId: 'b', from: 2, to: 3 },
    ])
    expect(plan.shiftedOverrides.has('b')).toBe(false)
    expect(plan.shiftedOverrides.get('c')).toEqual({ startYmd: '2026-05-30', endYmd: '2026-05-31' })
  })

  it('uses the first stage start as anchor when todayYmd is malformed', () => {
    const stages = [s('a', 1, '2026-05-25', '2026-05-26')]
    const plan = planInsertStageAfter({
      stages,
      afterStageId: null,
      todayYmd: 'not-a-date',
    })
    expect(plan.newRow.startYmd).toBe('2026-05-25')
  })

  it('handles month/year boundary date arithmetic correctly', () => {
    const stages = [
      s('a', 1, '2026-12-29', '2026-12-30'),
      s('b', 2, '2026-12-31', '2027-01-02'),
    ]
    const plan = planInsertStageAfter({ stages, afterStageId: 'a', todayYmd: TODAY, lengthDays: 3 })
    expect(plan.newRow.startYmd).toBe('2026-12-31') // a.endYmd + 1
    expect(plan.newRow.endYmd).toBe('2027-01-02')
    expect(plan.shiftedOverrides.get('b')).toEqual({ startYmd: '2027-01-03', endYmd: '2027-01-05' })
  })
})
