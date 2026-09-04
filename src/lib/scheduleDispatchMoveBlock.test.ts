import { describe, expect, it } from 'vitest'
import { buildMoveDayChips, moveBlockChanged, moveBlockSaveLabel, moveDayLabel } from './scheduleDispatchMoveBlock'

const WEEK = ['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']

describe('buildMoveDayChips', () => {
  it('labels every visible day and flags the source', () => {
    const chips = buildMoveDayChips(WEEK, '2026-09-03')
    expect(chips.map((c) => c.weekday)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    expect(chips.map((c) => c.date)).toEqual(['8/31', '9/1', '9/2', '9/3', '9/4'])
    expect(chips.map((c) => c.isSource)).toEqual([false, false, false, true, false])
  })

  it('passes an unparseable key through as its own label', () => {
    expect(buildMoveDayChips(['garbage'], 'x')[0]).toEqual({ ymd: 'garbage', weekday: 'garbage', date: '', isSource: false })
  })
})

describe('moveDayLabel', () => {
  it('reads "Fri 9/4"', () => {
    expect(moveDayLabel('2026-09-04')).toBe('Fri 9/4')
  })
})

describe('moveBlockSaveLabel / moveBlockChanged', () => {
  const base = { sourceYmd: '2026-09-03', sourceUserId: 'abraham', targetYmd: '2026-09-03', targetUserId: 'abraham' }

  it('says nothing to move when the selection is the current cell', () => {
    expect(moveBlockChanged(base)).toBe(false)
    expect(moveBlockSaveLabel(base, 'Abraham')).toBe('Nothing to move')
  })

  it('names only the day when only the day changes', () => {
    const s = { ...base, targetYmd: '2026-09-04' }
    expect(moveBlockChanged(s)).toBe(true)
    expect(moveBlockSaveLabel(s, 'Abraham')).toBe('Move to Fri 9/4')
  })

  it('names only the person when only the person changes', () => {
    expect(moveBlockSaveLabel({ ...base, targetUserId: 'paige' }, 'Paige')).toBe('Move to Paige')
  })

  it('names both when both change', () => {
    expect(moveBlockSaveLabel({ ...base, targetYmd: '2026-09-04', targetUserId: 'paige' }, 'Paige')).toBe('Move to Fri 9/4 · Paige')
  })
})
