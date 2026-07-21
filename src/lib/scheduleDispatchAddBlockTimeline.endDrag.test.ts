import { describe, expect, it } from 'vitest'
import { endDragRangeAcrossGaps } from './scheduleDispatchAddBlockTimeline'
import { MIN_MIN, MAX_MIN } from './dispatchAddBlockTime'

/** Day is 04:00 (240) – 20:00 (1200). One occupied band 10:00–12:00 (600–720)
 * splits it into gaps [240,600] and [720,1200] for most cases below. */
const GAPS = [
  { startMin: 240, endMin: 600 },
  { startMin: 720, endMin: 1200 },
]

describe('endDragRangeAcrossGaps', () => {
  it('follows the pointer inside the current gap without moving the start', () => {
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 570, gaps: GAPS })).toEqual({
      startMin: 480,
      endMin: 570,
    })
  })

  it('pins the end at the band start while dragging through the occupied band', () => {
    // Block 8:00–10:00; end dragged to 11:00 (inside the 10–12 band): resistance.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 660, gaps: GAPS })).toEqual({
      startMin: 480,
      endMin: 600,
    })
    // Even just past the band's end but NOT yet 30m into the next gap: still pinned.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 735, gaps: GAPS })).toEqual({
      startMin: 480,
      endMin: 600,
    })
  })

  it('hops the start past the band once the end clears it by the minimum duration', () => {
    // End at 12:30 = band end (12:00) + 30m: start jumps to 12:00, block 12:00–12:30.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 750, gaps: GAPS })).toEqual({
      startMin: 720,
      endMin: 750,
    })
    // Keep dragging: end follows, start stays at the gap start.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 900, gaps: GAPS })).toEqual({
      startMin: 720,
      endMin: 900,
    })
  })

  it('hops across MULTIPLE bands to the right-most cleared gap', () => {
    const gaps = [
      { startMin: 240, endMin: 480 },
      { startMin: 540, endMin: 600 },
      { startMin: 720, endMin: 1200 },
    ]
    // End dragged all the way to 13:00 from a block in the first gap: lands in the third gap.
    expect(endDragRangeAcrossGaps({ currentStartMin: 300, desiredEndMin: 780, gaps })).toEqual({
      startMin: 720,
      endMin: 780,
    })
  })

  it('pulls the start right only when the minimum duration forces it (same gap)', () => {
    // Block 8:00–10:00, end dragged left to 8:15 (< start+30): start slides to 7:45.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 495, gaps: GAPS })).toEqual({
      startMin: 465,
      endMin: 495,
    })
  })

  it('hops backward when the end is dragged left past the current gap start', () => {
    // Block 12:00–14:00 (second gap); end dragged left to 9:00 (inside first gap):
    // minimum-duration block ending at the pointer.
    expect(endDragRangeAcrossGaps({ currentStartMin: 720, desiredEndMin: 540, gaps: GAPS })).toEqual({
      startMin: 510,
      endMin: 540,
    })
  })

  it('clamps to the day and the gap edges', () => {
    // Dragged past the end of the day: pinned to the last gap's end.
    expect(endDragRangeAcrossGaps({ currentStartMin: 720, desiredEndMin: MAX_MIN + 500, gaps: GAPS })).toEqual({
      startMin: 720,
      endMin: 1200,
    })
    // Dragged to the very start of the day: minimum block at the first gap's start.
    expect(endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: MIN_MIN, gaps: GAPS })).toEqual({
      startMin: 240,
      endMin: 270,
    })
  })

  it('falls back to a simple min-duration clamp when there are no gaps', () => {
    const r = endDragRangeAcrossGaps({ currentStartMin: 480, desiredEndMin: 600, gaps: [] })
    expect(r.endMin).toBe(600)
    expect(r.startMin).toBe(480)
  })
})
