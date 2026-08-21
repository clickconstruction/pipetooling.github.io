import { describe, expect, it } from 'vitest'
import { computeStageOrderUpdates, computeTaskOrderUpdates, stageNumbersByGroupId, taskNumbersByTaskId } from './roadmapStageNumbers'

describe('stageNumbersByGroupId', () => {
  it('numbers stages 1..N in list order', () => {
    const m = stageNumbersByGroupId([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    expect(m.get('a')).toBe(1)
    expect(m.get('b')).toBe(2)
    expect(m.get('c')).toBe(3)
    expect(m.size).toBe(3)
  })
  it('empty list -> empty map', () => {
    expect(stageNumbersByGroupId([]).size).toBe(0)
  })
})

describe('taskNumbersByTaskId', () => {
  const stageNumbers = new Map([
    ['g1', 1],
    ['g2', 2],
  ])
  it('numbers tasks N.M within their stage', () => {
    const m = taskNumbersByTaskId(
      stageNumbers,
      new Map([
        ['g1', [{ id: 'a' }, { id: 'b' }]],
        ['g2', [{ id: 'c' }]],
      ]),
    )
    expect(m.get('a')).toBe('1.1')
    expect(m.get('b')).toBe('1.2')
    expect(m.get('c')).toBe('2.1')
  })
  it('skips tasks in groups without a stage number', () => {
    const m = taskNumbersByTaskId(stageNumbers, new Map([['ghost', [{ id: 'x' }]]]))
    expect(m.size).toBe(0)
  })
})

describe('computeTaskOrderUpdates', () => {
  const tasks = [
    { id: 'a', group_id: 'g1', sort_index: 1 },
    { id: 'b', group_id: 'g1', sort_index: 2 },
    { id: 'c', group_id: 'g1', sort_index: 3 },
    { id: 'd', group_id: 'g2', sort_index: 1 },
  ]
  it('unchanged orders -> no updates', () => {
    expect(
      computeTaskOrderUpdates(
        new Map([
          ['g1', ['a', 'b', 'c']],
          ['g2', ['d']],
        ]),
        tasks,
      ),
    ).toEqual([])
  })
  it('within-group move updates only the shifted rows', () => {
    expect(computeTaskOrderUpdates(new Map([['g1', ['b', 'a', 'c']]]), tasks)).toEqual([
      { id: 'b', sort_index: 1 },
      { id: 'a', sort_index: 2 },
    ])
  })
  it('skips deleted ids and group mismatches', () => {
    expect(computeTaskOrderUpdates(new Map([['g1', ['ghost', 'd', 'a']]]), tasks)).toEqual([
      { id: 'a', sort_index: 3 },
    ])
  })
})

describe('computeStageOrderUpdates', () => {
  const current = [
    { id: 'a', sort_index: 1 },
    { id: 'b', sort_index: 2 },
    { id: 'c', sort_index: 3 },
  ]
  it('unchanged order -> no updates', () => {
    expect(computeStageOrderUpdates(['a', 'b', 'c'], current)).toEqual([])
  })
  it('moving a stage updates only the rows whose position changed', () => {
    expect(computeStageOrderUpdates(['b', 'a', 'c'], current)).toEqual([
      { id: 'b', sort_index: 1 },
      { id: 'a', sort_index: 2 },
    ])
  })
  it('normalizes sparse stored indexes to dense 1..N', () => {
    const sparse = [
      { id: 'a', sort_index: 3 },
      { id: 'b', sort_index: 7 },
    ]
    expect(computeStageOrderUpdates(['a', 'b'], sparse)).toEqual([
      { id: 'a', sort_index: 1 },
      { id: 'b', sort_index: 2 },
    ])
  })
  it('skips ids missing from current (deleted mid-drag)', () => {
    expect(computeStageOrderUpdates(['ghost', 'a'], current)).toEqual([{ id: 'a', sort_index: 2 }])
  })
})
