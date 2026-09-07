import { describe, expect, it } from 'vitest'
import {
  applySegmentDragDelta,
  applySegmentMoveToAbsoluteStart,
  clampNewBlockRangeToGaps,
  defaultNewBlockRangeInFirstGap,
  effectiveSegmentRange,
  endDragRangeAcrossGaps,
  gapsFromOccupied,
  mergeOccupiedIntervals,
  occupiedUnionFromSegments,
  virtualDayBlocksForOverlap,
  type AddBlockTimelineSegment,
} from './scheduleDispatchAddBlockTimeline'

const M = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}
const seg = (blockId: string, time_start: string, time_end: string, extra: Partial<AddBlockTimelineSegment> = {}): AddBlockTimelineSegment => ({
  blockId,
  jobId: 'J1',
  label: blockId,
  time_start,
  time_end,
  shared_block_group_id: null,
  ...extra,
})
const DAY = { startMin: M('04:00'), endMin: M('20:00') }

describe('ranges and gaps', () => {
  it('effectiveSegmentRange prefers the draft and accepts HH:MM or HH:MM:SS', () => {
    const s = seg('a', '08:00:00', '10:00:00')
    expect(effectiveSegmentRange(s, undefined)).toEqual({ startMin: 480, endMin: 600 })
    expect(effectiveSegmentRange(s, { time_start: '09:00', time_end: '11:30' })).toEqual({ startMin: 540, endMin: 690 })
  })
  it('mergeOccupiedIntervals sorts and merges overlapping or touching intervals', () => {
    expect(mergeOccupiedIntervals([])).toEqual([])
    expect(
      mergeOccupiedIntervals([
        { startMin: 600, endMin: 660 },
        { startMin: 480, endMin: 600 },
        { startMin: 800, endMin: 900 },
        { startMin: 850, endMin: 860 },
      ]),
    ).toEqual([
      { startMin: 480, endMin: 660 },
      { startMin: 800, endMin: 900 },
    ])
  })
  it('occupiedUnionFromSegments applies drafts, clamps to the day and drops empty ranges', () => {
    const segs = [seg('a', '03:00', '05:00'), seg('b', '19:00', '23:00'), seg('c', '10:00', '10:00'), seg('d', '12:00', '13:00')]
    expect(occupiedUnionFromSegments(segs, { d: { time_start: '12:30', time_end: '14:00' } })).toEqual([
      { startMin: 240, endMin: 300 },
      { startMin: 750, endMin: 840 },
      { startMin: 1140, endMin: 1200 },
    ])
  })
  it('gapsFromOccupied returns the free windows inside the day', () => {
    expect(gapsFromOccupied([])).toEqual([DAY])
    expect(gapsFromOccupied([{ startMin: 480, endMin: 600 }, { startMin: 780, endMin: 840 }])).toEqual([
      { startMin: 240, endMin: 480 },
      { startMin: 600, endMin: 780 },
      { startMin: 840, endMin: 1200 },
    ])
    expect(gapsFromOccupied([DAY])).toEqual([])
  })
})

describe('defaultNewBlockRangeInFirstGap', () => {
  it('an empty day gets 8 AM–4 PM', () => {
    expect(defaultNewBlockRangeInFirstGap({ segments: [], draftByBlockId: {} })).toEqual({ startMin: 480, endMin: 960 })
  })
  it('a morning block pushes the default into the first gap that fits, ending before the block', () => {
    // occupied 10:00–12:00 → first gap 04:00–10:00 (6 h) → 6 h block ending at 10:00
    expect(defaultNewBlockRangeInFirstGap({ segments: [seg('a', '10:00', '12:00')], draftByBlockId: {} })).toEqual({ startMin: 240, endMin: 600 })
  })
  it('skips gaps shorter than 30 minutes and returns null when nothing fits', () => {
    expect(defaultNewBlockRangeInFirstGap({ segments: [seg('a', '04:20', '20:00')], draftByBlockId: {} })).toBeNull()
    expect(defaultNewBlockRangeInFirstGap({ segments: [seg('a', '04:00', '20:00')], draftByBlockId: {} })).toBeNull()
    expect(defaultNewBlockRangeInFirstGap({ segments: [seg('a', '04:00', '09:00'), seg('b', '09:20', '20:00')], draftByBlockId: {} })).toBeNull()
  })
  it('honours a preferred start inside a later gap', () => {
    expect(defaultNewBlockRangeInFirstGap({ segments: [seg('a', '04:00', '09:00')], draftByBlockId: {}, preferStartMin: M('13:00'), preferDurationMin: 120 })).toEqual({ startMin: 780, endMin: 900 })
  })
})

describe('clampNewBlockRangeToGaps', () => {
  const gaps = [
    { startMin: M('04:00'), endMin: M('08:00') },
    { startMin: M('12:00'), endMin: M('20:00') },
  ]
  it('leaves a range that already sits inside a gap alone', () => {
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('13:00'), desiredEndMin: M('15:00'), gaps })).toEqual({ startMin: 780, endMin: 900 })
  })
  it('enforces the 30-minute minimum', () => {
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('13:00'), desiredEndMin: M('13:10'), gaps })).toEqual({ startMin: 780, endMin: 810 })
  })
  it('a range crossing into the occupied band is pulled back inside the gap holding its midpoint', () => {
    // 07:00–09:00: midpoint 08:00 sits on the first gap's edge → fit 2 h ending at 08:00
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('07:00'), desiredEndMin: M('09:00'), gaps })).toEqual({ startMin: 360, endMin: 480 })
  })
  it('a range whose midpoint is inside the occupied band goes to the nearest gap', () => {
    // 09:00–11:00: midpoint 10:00 → nearest gap edges 08:00 (2 h) vs 12:00 (2 h): first wins the tie
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('09:00'), desiredEndMin: M('11:00'), gaps })).toEqual({ startMin: 360, endMin: 480 })
    // 10:30–11:30: midpoint 11:00 is nearer 12:00
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('10:30'), desiredEndMin: M('11:30'), gaps })).toEqual({ startMin: 720, endMin: 780 })
  })
  it('a range longer than the gap fills the gap', () => {
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('04:00'), desiredEndMin: M('10:00'), gaps })).toEqual({ startMin: 240, endMin: 480 })
  })
  it('with no gaps at all it clamps to the day', () => {
    expect(clampNewBlockRangeToGaps({ desiredStartMin: M('19:50'), desiredEndMin: M('20:30'), gaps: [] })).toEqual({ startMin: 1170, endMin: 1200 })
  })
})

describe('endDragRangeAcrossGaps', () => {
  const gaps = [
    { startMin: M('04:00'), endMin: M('08:00') },
    { startMin: M('12:00'), endMin: M('20:00') },
  ]
  it('inside the current gap the end follows the pointer', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('05:00'), desiredEndMin: M('07:00'), gaps })).toEqual({ startMin: 300, endMin: 420 })
  })
  it('dragged into the occupied band, the end pins at the band start', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('05:00'), desiredEndMin: M('10:00'), gaps })).toEqual({ startMin: 300, endMin: 480 })
    // …until the next gap's start is cleared by less than the minimum
    expect(endDragRangeAcrossGaps({ currentStartMin: M('05:00'), desiredEndMin: M('12:20'), gaps })).toEqual({ startMin: 300, endMin: 480 })
  })
  it('cleared by the minimum duration, the block hops into the later gap and keeps following', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('05:00'), desiredEndMin: M('12:30'), gaps })).toEqual({ startMin: 720, endMin: 750 })
    expect(endDragRangeAcrossGaps({ currentStartMin: M('05:00'), desiredEndMin: M('15:00'), gaps })).toEqual({ startMin: 720, endMin: 900 })
  })
  it('dragged left past its gap, the block hops backward to a minimum block ending at the pointer', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('13:00'), desiredEndMin: M('06:00'), gaps })).toEqual({ startMin: 330, endMin: 360 })
    expect(endDragRangeAcrossGaps({ currentStartMin: M('13:00'), desiredEndMin: M('04:10'), gaps })).toEqual({ startMin: 240, endMin: 270 })
  })
  it('the start only moves when the minimum duration forces it', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('07:00'), desiredEndMin: M('07:10'), gaps })).toEqual({ startMin: 400, endMin: 430 })
  })
  it('with no gaps the end follows the pointer within the day', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: M('09:00'), desiredEndMin: M('11:00'), gaps: [] })).toEqual({ startMin: 540, endMin: 660 })
    expect(endDragRangeAcrossGaps({ currentStartMin: M('09:00'), desiredEndMin: M('03:00'), gaps: [] })).toEqual({ startMin: 240, endMin: 270 })
  })
})

describe('applySegmentDragDelta', () => {
  const segs = [seg('a', '08:00', '09:00'), seg('b', '10:00', '12:00')]

  it('a zero delta returns the same draft object', () => {
    const drafts = {}
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: drafts, seedBlockId: 'a', deltaMin: 0 })).toBe(drafts)
  })
  it('moves a block by the delta and writes HH:MM drafts', () => {
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: {}, seedBlockId: 'a', deltaMin: 30 })).toEqual({ a: { time_start: '08:30', time_end: '09:30' } })
  })
  it('a move into another block backs off in 5-minute steps to the last clear slot', () => {
    // +90 → 09:30–10:30 overlaps b (10:00–) → back to 09:00–10:00
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: {}, seedBlockId: 'a', deltaMin: 90 })).toEqual({ a: { time_start: '09:00', time_end: '10:00' } })
  })
  it('returns null when no movement in that direction is possible', () => {
    const tight = [seg('a', '08:00', '09:00'), seg('b', '09:00', '12:00')]
    expect(applySegmentDragDelta({ segments: tight, draftByBlockId: {}, seedBlockId: 'a', deltaMin: 10 })).toBeNull()
  })
  it('clamps to the day and respects an existing draft as the starting point', () => {
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: { a: { time_start: '18:00', time_end: '19:00' } }, seedBlockId: 'a', deltaMin: 600 })).toEqual({ a: { time_start: '19:00', time_end: '20:00' } })
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: {}, seedBlockId: 'a', deltaMin: -600 })).toEqual({ a: { time_start: '04:00', time_end: '05:00' } })
  })
  it('refuses a block shorter than the minimum and an unknown seed', () => {
    expect(applySegmentDragDelta({ segments: [seg('t', '08:00', '08:10')], draftByBlockId: {}, seedBlockId: 't', deltaMin: 30 })).toBeNull()
    expect(applySegmentDragDelta({ segments: segs, draftByBlockId: {}, seedBlockId: 'zzz', deltaMin: 30 })).toBeNull()
  })
  it('linked legs on the same job move together; a different job in the same group stays put', () => {
    const linked = [
      seg('a', '08:00', '09:00', { shared_block_group_id: 'g1' }),
      seg('b', '08:00', '09:00', { shared_block_group_id: 'g1' }),
      seg('c', '08:00', '09:00', { shared_block_group_id: 'g1', jobId: 'J2' }),
      seg('d', '13:00', '14:00'),
    ]
    const out = applySegmentDragDelta({ segments: linked, draftByBlockId: {}, seedBlockId: 'a', deltaMin: 60 })
    expect(out).toEqual({ a: { time_start: '09:00', time_end: '10:00' }, b: { time_start: '09:00', time_end: '10:00' } })
  })
  it('applySegmentMoveToAbsoluteStart is a delta from the current effective start', () => {
    expect(applySegmentMoveToAbsoluteStart({ segments: segs, draftByBlockId: {}, seedBlockId: 'a', desiredStartMin: M('13:00') })).toEqual({ a: { time_start: '13:00', time_end: '14:00' } })
    expect(applySegmentMoveToAbsoluteStart({ segments: segs, draftByBlockId: {}, seedBlockId: 'nope', desiredStartMin: 600 })).toBeNull()
  })
})

describe('virtualDayBlocksForOverlap', () => {
  it('patches drafted rows into Postgres time strings and leaves the rest untouched', () => {
    const rows = [
      { id: 'a', time_start: '08:00:00', time_end: '09:00:00' },
      { id: 'b', time_start: '10:00:00', time_end: '12:00:00' },
    ]
    expect(virtualDayBlocksForOverlap(rows, { a: { time_start: '08:30', time_end: '09:30' } })).toEqual([
      { id: 'a', time_start: '08:30:00', time_end: '09:30:00' },
      rows[1],
    ])
  })
})
