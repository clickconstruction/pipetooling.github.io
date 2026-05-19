import { describe, it, expect } from 'vitest'
import {
  buildDragEditPlan,
  type DragEditStageInput,
} from './projectsForecastDragEdit'

function stage(
  partial: Partial<DragEditStageInput> & { stageId: string; sequenceOrder: number },
): DragEditStageInput {
  return {
    startYmd: '2026-01-01',
    endYmd: '2026-01-05',
    ...partial,
  }
}

describe('buildDragEditPlan', () => {
  it('shifts the dragged stage end and every later stage by the same delta, preserving gaps', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      // 1-day gap before B (B starts 2026-01-07, A ends 2026-01-05)
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-07', endYmd: '2026-01-12' }),
      // 0-day gap before C (C starts the day after B ends)
      stage({ stageId: 'c', sequenceOrder: 3, startYmd: '2026-01-13', endYmd: '2026-01-15' }),
      // 5-day gap before D
      stage({ stageId: 'd', sequenceOrder: 4, startYmd: '2026-01-21', endYmd: '2026-01-25' }),
    ]
    const plan = buildDragEditPlan(stages, 'b', 3)
    expect(plan.effectiveDeltaDays).toBe(3)
    expect(plan.overrides.size).toBe(3)
    // Dragged stage: only end moves; start unchanged.
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-07', endYmd: '2026-01-15' })
    // Later stages shift by +3 days for both start and end.
    expect(plan.overrides.get('c')).toEqual({ startYmd: '2026-01-16', endYmd: '2026-01-18' })
    expect(plan.overrides.get('d')).toEqual({ startYmd: '2026-01-24', endYmd: '2026-01-28' })
    // Stage A (before the dragged one) is untouched.
    expect(plan.overrides.has('a')).toBe(false)

    // Gap from B end -> C start was 0 days before, still 0 after the drag.
    expect(plan.overrides.get('b')!.endYmd).toBe('2026-01-15')
    expect(plan.overrides.get('c')!.startYmd).toBe('2026-01-16')
    // Gap from C end -> D start was 5 days before, still 5 after.
    expect(plan.overrides.get('c')!.endYmd).toBe('2026-01-18')
    expect(plan.overrides.get('d')!.startYmd).toBe('2026-01-24')
  })

  it('emits only the dragged stage when it is the last stage', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-06', endYmd: '2026-01-10' }),
    ]
    const plan = buildDragEditPlan(stages, 'b', 4)
    expect(plan.effectiveDeltaDays).toBe(4)
    expect(plan.overrides.size).toBe(1)
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-06', endYmd: '2026-01-14' })
    expect(plan.overrides.has('a')).toBe(false)
  })

  it('returns an empty plan for delta = 0', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1 }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-06', endYmd: '2026-01-10' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', 0)
    expect(plan.effectiveDeltaDays).toBe(0)
    expect(plan.overrides.size).toBe(0)
  })

  it('clamps a negative delta so the dragged end never goes before its start', () => {
    const stages: DragEditStageInput[] = [
      // 4-day length: 2026-01-01 -> 2026-01-05 (delta = 4 days)
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-10', endYmd: '2026-01-15' }),
    ]
    // Requested -10 should clamp to -4 (so end == start, length = 1 day).
    const plan = buildDragEditPlan(stages, 'a', -10)
    expect(plan.effectiveDeltaDays).toBe(-4)
    expect(plan.overrides.size).toBe(2)
    // Dragged stage: end shrinks to start, start unchanged.
    expect(plan.overrides.get('a')).toEqual({ startYmd: '2026-01-01', endYmd: '2026-01-01' })
    // Later stage shifts by the SAME clamped delta (-4 days).
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-06', endYmd: '2026-01-11' })
  })

  it('passes a negative delta within bounds through to later stages without auto-clamping cascades', () => {
    const stages: DragEditStageInput[] = [
      // length = 10 days, plenty of room for -3.
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-11' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-15', endYmd: '2026-01-20' }),
      stage({ stageId: 'c', sequenceOrder: 3, startYmd: '2026-01-25', endYmd: '2026-01-30' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', -3)
    expect(plan.effectiveDeltaDays).toBe(-3)
    expect(plan.overrides.get('a')).toEqual({ startYmd: '2026-01-01', endYmd: '2026-01-08' })
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-12', endYmd: '2026-01-17' })
    expect(plan.overrides.get('c')).toEqual({ startYmd: '2026-01-22', endYmd: '2026-01-27' })
  })

  it('returns an empty plan when the dragged id is not present in the stage list', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1 }),
      stage({ stageId: 'b', sequenceOrder: 2 }),
    ]
    const plan = buildDragEditPlan(stages, 'does-not-exist', 5)
    expect(plan.effectiveDeltaDays).toBe(0)
    expect(plan.overrides.size).toBe(0)
  })

  it('preserves an existing overlap between the dragged stage and the next one', () => {
    const stages: DragEditStageInput[] = [
      // A ends 2026-01-10, B starts 2026-01-08 → 2-day overlap (B starts 2 days before A ends).
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-10' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-08', endYmd: '2026-01-15' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', 5)
    expect(plan.effectiveDeltaDays).toBe(5)
    // After +5: A ends 2026-01-15, B starts 2026-01-13. Overlap (A.endYmd - B.startYmd) is
    // still 2 days, identical to the pre-drag overlap.
    expect(plan.overrides.get('a')).toEqual({ startYmd: '2026-01-01', endYmd: '2026-01-15' })
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-13', endYmd: '2026-01-20' })
  })

  it('returns an empty plan for an empty stage list', () => {
    const plan = buildDragEditPlan([], 'a', 5)
    expect(plan.effectiveDeltaDays).toBe(0)
    expect(plan.overrides.size).toBe(0)
  })

  it('ignores stages with the same sequence_order as the dragged stage (only strictly higher shift)', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      // Sibling sharing seq order 1 — should NOT shift even though it's after `a` in the array.
      stage({ stageId: 'a-sibling', sequenceOrder: 1, startYmd: '2026-01-06', endYmd: '2026-01-08' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-10', endYmd: '2026-01-12' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', 2)
    expect(plan.overrides.has('a-sibling')).toBe(false)
    expect(plan.overrides.has('b')).toBe(true)
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-12', endYmd: '2026-01-14' })
  })
})

describe('buildDragEditPlan (translate mode)', () => {
  it('shifts the dragged stage start AND end forward by the same delta and cascades later stages', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-07', endYmd: '2026-01-12' }),
      stage({ stageId: 'c', sequenceOrder: 3, startYmd: '2026-01-15', endYmd: '2026-01-20' }),
    ]
    const plan = buildDragEditPlan(stages, 'b', 4, 'translate')
    expect(plan.effectiveDeltaDays).toBe(4)
    expect(plan.overrides.size).toBe(2)
    // Dragged stage: BOTH ends move (length preserved).
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-11', endYmd: '2026-01-16' })
    // Later stage shifts by the same delta.
    expect(plan.overrides.get('c')).toEqual({ startYmd: '2026-01-19', endYmd: '2026-01-24' })
    // Earlier stage is untouched.
    expect(plan.overrides.has('a')).toBe(false)
  })

  it('preserves the dragged stage length exactly when translating forward', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-10', endYmd: '2026-01-25' }),
    ]
    const plan = buildDragEditPlan(stages, 'b', 7, 'translate')
    const ov = plan.overrides.get('b')!
    // Generic YMD diff — handles month rollover unlike a January-only Date.UTC slice.
    const ymdToMs = (y: string): number => {
      const [yr, mo, da] = y.split('-').map(Number) as [number, number, number]
      return Date.UTC(yr, mo - 1, da)
    }
    const originalLen = ymdToMs('2026-01-25') - ymdToMs('2026-01-10')
    const newLen = ymdToMs(ov.endYmd) - ymdToMs(ov.startYmd)
    expect(newLen).toBe(originalLen)
  })

  it('shifts the dragged stage backward (negative delta) without any length clamp', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      // 1-day length stage being dragged backward by 10 days — translate is unaffected by
      // the length clamp that extend-mode applies.
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-02-15', endYmd: '2026-02-15' }),
      stage({ stageId: 'c', sequenceOrder: 3, startYmd: '2026-02-20', endYmd: '2026-02-25' }),
    ]
    const plan = buildDragEditPlan(stages, 'b', -10, 'translate')
    expect(plan.effectiveDeltaDays).toBe(-10)
    // Both ends moved by -10, preserving the 0-day length.
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-02-05', endYmd: '2026-02-05' })
    // Later stage cascades by the same -10.
    expect(plan.overrides.get('c')).toEqual({ startYmd: '2026-02-10', endYmd: '2026-02-15' })
    expect(plan.overrides.has('a')).toBe(false)
  })

  it('preserves the original gap to the next stage in translate mode', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1, startYmd: '2026-01-01', endYmd: '2026-01-05' }),
      // 5-day gap before B
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-10', endYmd: '2026-01-12' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', 3, 'translate')
    expect(plan.overrides.get('a')).toEqual({ startYmd: '2026-01-04', endYmd: '2026-01-08' })
    // B cascades by +3; gap (B.start - A.end) was 5 days before, still 5 days after.
    expect(plan.overrides.get('b')).toEqual({ startYmd: '2026-01-13', endYmd: '2026-01-15' })
    const aEnd = Date.UTC(2026, 0, 8)
    const bStart = Date.UTC(2026, 0, 13)
    expect(Math.round((bStart - aEnd) / 86400000)).toBe(5)
  })

  it('returns an empty plan for translate-mode delta = 0', () => {
    const stages: DragEditStageInput[] = [
      stage({ stageId: 'a', sequenceOrder: 1 }),
      stage({ stageId: 'b', sequenceOrder: 2, startYmd: '2026-01-06', endYmd: '2026-01-10' }),
    ]
    const plan = buildDragEditPlan(stages, 'a', 0, 'translate')
    expect(plan.effectiveDeltaDays).toBe(0)
    expect(plan.overrides.size).toBe(0)
  })
})
