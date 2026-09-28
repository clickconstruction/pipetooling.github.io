import { describe, expect, it } from 'vitest'
import { buildStageDisplayItems } from './stageDisplayItems'

type S = { id: string; status: string; sequence_order: number | null; started_at: string | null }

function step(id: string, status: string, sequence_order: number | null, started_at: string | null = null): S {
  return { id, status, sequence_order, started_at }
}

const shape = (items: ReturnType<typeof buildStageDisplayItems<S>>) =>
  items.map((i) => (i.type === 'step' ? i.step.id : `summary:${i.count}:${i.firstStarted}`))

describe('buildStageDisplayItems', () => {
  const steps = [
    step('a', 'approved', 1, '2026-09-01T12:00:00Z'),
    step('b', 'completed', 2, '2026-09-03T12:00:00Z'),
    step('c', 'skipped', 3),
    step('d', 'in_progress', 4, '2026-09-08T12:00:00Z'),
    step('e', 'pending', 5),
  ]

  it('draws every step while old steps are shown', () => {
    expect(shape(buildStageDisplayItems(steps, false))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('hides the finished steps behind one summary row, keeping the most recent finished one', () => {
    expect(shape(buildStageDisplayItems(steps, true))).toEqual([
      'summary:2:2026-09-01T12:00:00Z',
      'c',
      'd',
      'e',
    ])
  })

  it('counts completed, approved and skipped as finished — not rejected', () => {
    const items = buildStageDisplayItems(
      [step('a', 'rejected', 1), step('b', 'completed', 2), step('c', 'approved', 3)],
      true,
    )
    expect(shape(items)).toEqual(['a', 'summary:1:null', 'c'])
  })

  it('has nothing to hide with one finished step, or none', () => {
    expect(shape(buildStageDisplayItems([step('a', 'completed', 1), step('b', 'pending', 2)], true))).toEqual(['a', 'b'])
    expect(shape(buildStageDisplayItems([step('a', 'pending', 1)], true))).toEqual(['a'])
    expect(buildStageDisplayItems([], true)).toEqual([])
  })

  it('puts the summary where the first old step was, however the old steps are scattered', () => {
    const items = buildStageDisplayItems(
      [
        step('p', 'pending', 1),
        step('a', 'completed', 2, '2026-09-02T12:00:00Z'),
        step('q', 'in_progress', 3),
        step('b', 'approved', 4),
        step('c', 'completed', 5),
      ],
      true,
    )
    expect(shape(items)).toEqual(['p', 'summary:2:2026-09-02T12:00:00Z', 'q', 'c'])
  })

  it('picks the most recent finished step by sequence_order, not by list position', () => {
    // Listed out of order: 'late' has the highest order, so it is the one that stays.
    const items = buildStageDisplayItems(
      [step('late', 'completed', 9, '2026-09-09T12:00:00Z'), step('early', 'completed', 1, '2026-09-01T12:00:00Z')],
      true,
    )
    expect(shape(items)).toEqual(['late', 'summary:1:2026-09-01T12:00:00Z'])
  })

  it('reads a missing sequence_order as 0', () => {
    const items = buildStageDisplayItems([step('x', 'completed', null), step('y', 'completed', 1)], true)
    expect(shape(items)).toEqual(['summary:1:null', 'y'])
  })

  it('takes the summary’s start from the first old step by order, even when it never started', () => {
    const items = buildStageDisplayItems(
      [step('a', 'skipped', 1, null), step('b', 'completed', 2, '2026-09-03T12:00:00Z'), step('c', 'completed', 3)],
      true,
    )
    expect(shape(items)).toEqual(['summary:2:null', 'c'])
  })

  it('hands back the same step objects and leaves the list it was given alone', () => {
    const given = [step('b', 'completed', 2), step('a', 'completed', 1)]
    const items = buildStageDisplayItems(given, false)
    expect(items[0]).toEqual({ type: 'step', step: given[0] })
    expect(items[0]?.type === 'step' && items[0].step).toBe(given[0])
    expect(given.map((s) => s.id)).toEqual(['b', 'a'])
  })
})
