import { describe, expect, it } from 'vitest'
import {
  LINE_MAX,
  allTicked,
  criteriaForCard,
  criteriaRows,
  criterionEventBody,
  diffLines,
  isLastOpenLine,
  lineStates,
  nextOpenLine,
  parseCriterionEvent,
  parseLines,
  tickedCount,
  type TaskCriterion,
} from './taskCriteria'

const c = (id: string, over: Partial<TaskCriterion> = {}): TaskCriterion => ({
  id,
  checklist_item_id: 'item1',
  roadmap_task_id: null,
  body: `line ${id}`,
  sort_index: 0,
  retired_at: null,
  ...over,
})

describe('criteriaForCard', () => {
  it('takes the card’s own live lines and its roadmap task’s, in order, once', () => {
    const rows = [
      c('b', { sort_index: 2 }),
      c('a', { sort_index: 1 }),
      c('r', { checklist_item_id: null, roadmap_task_id: 'task1', sort_index: 0 }),
      c('x', { checklist_item_id: 'other' }),
      c('gone', { retired_at: '2026-11-06T00:00:00Z' }),
      c('a', { sort_index: 1 }),
    ]
    expect(criteriaForCard({ itemId: 'item1', roadmapTaskId: 'task1' }, rows).map((r) => r.id)).toEqual(['r', 'a', 'b'])
    expect(criteriaForCard({ itemId: 'item1' }, rows).map((r) => r.id)).toEqual(['a', 'b'])
  })
})

describe('line states', () => {
  const lines = [c('1', { sort_index: 0 }), c('2', { sort_index: 1 }), c('3', { sort_index: 2 })]
  const checks = [
    { criterion_id: '1', instance_id: 'inst', checked_at: '2026-11-06T09:12:00Z', checked_by: 'u1', photo_id: 'p1' },
    { criterion_id: '2', instance_id: 'other', checked_at: '2026-11-06T09:40:00Z', checked_by: 'u1' },
  ]
  it('reads each line’s tick on this day row only', () => {
    const s = lineStates(lines, checks, 'inst')
    expect(s.map((x) => x.checked)).toEqual([true, false, false])
    expect(s[0]).toMatchObject({ checkedAt: '2026-11-06T09:12:00Z', checkedBy: 'u1', photoId: 'p1' })
    expect(tickedCount(s)).toBe(1)
    expect(nextOpenLine(s)?.criterion.id).toBe('2')
    expect(allTicked(s)).toBe(false)
  })
  it('knows the last open line, whose tick brings the finish', () => {
    const s = lineStates(lines, [...checks, { criterion_id: '2', instance_id: 'inst', checked_at: 'x', checked_by: null }], 'inst')
    expect(isLastOpenLine(s, '3')).toBe(true)
    expect(isLastOpenLine(s, '1')).toBe(false)
    expect(nextOpenLine(lineStates(lines, [], 'inst'))?.criterion.id).toBe('1')
    expect(allTicked([])).toBe(false)
  })
})

describe('the thread’s line', () => {
  it('writes a tick as ✓ and an untick as ○ and reads them back', () => {
    expect(criterionEventBody(' Pipe is racked by size ', true)).toBe('✓ Pipe is racked by size')
    expect(criterionEventBody('Pipe is racked by size', false)).toBe('○ Pipe is racked by size')
    expect(parseCriterionEvent('✓ Pipe is racked by size')).toEqual({ ticked: true, words: 'Pipe is racked by size' })
    expect(parseCriterionEvent('○ x')).toEqual({ ticked: false, words: 'x' })
    expect(parseCriterionEvent('just a comment')).toBeNull()
  })
})

describe('parseLines', () => {
  it('reads one line a row, drops empties and bullets, keeps a twice-typed line once, and stops at the limit', () => {
    expect(parseLines('Pipe racked\n\n- Fittings in bins\n2) The cart clear  \n• fittings in BINS\n')).toEqual(['Pipe racked', 'Fittings in bins', 'The cart clear'])
    expect(parseLines(Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n'))).toHaveLength(LINE_MAX)
    expect(parseLines('x'.repeat(300))[0]).toHaveLength(200)
    expect(parseLines('')).toEqual([])
  })
  it('turns the lines into rows for the card or the roadmap task', () => {
    expect(criteriaRows({ checklistItemId: 'i' }, ['a', 'b'], 'me')).toEqual([
      { checklist_item_id: 'i', roadmap_task_id: null, body: 'a', sort_index: 0, created_by: 'me' },
      { checklist_item_id: 'i', roadmap_task_id: null, body: 'b', sort_index: 1, created_by: 'me' },
    ])
    expect(criteriaRows({ roadmapTaskId: 't' }, ['a'], 'me')[0]).toMatchObject({ checklist_item_id: null, roadmap_task_id: 't' })
  })
})

describe('diffLines', () => {
  it('keeps lines by their words, adds the new ones, retires the gone ones, and orders by the new list', () => {
    const existing = [c('1', { body: 'Pipe racked', sort_index: 0 }), c('2', { body: 'Fittings in bins', sort_index: 1 }), c('old', { body: 'Gone', sort_index: 2, retired_at: 'x' })]
    expect(diffLines(existing, ['Fittings in bins', 'The cart clear', 'pipe racked'])).toEqual({
      keep: [
        { id: '2', sort_index: 0 },
        { id: '1', sort_index: 2 },
      ],
      add: [{ body: 'The cart clear', sort_index: 1 }],
      retire: [],
    })
    expect(diffLines(existing, [])).toEqual({ keep: [], add: [], retire: ['1', '2'] })
  })
})
