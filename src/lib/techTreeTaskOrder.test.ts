import { describe, expect, it } from 'vitest'
import { computeTaskReorderUpdates, techTreeEmptyGroupDropId, type TechTreeTaskIdRow } from './techTreeTaskOrder'

describe('techTreeTaskOrder', () => {
  it('moves within same list with consecutive 1-based sort_index', () => {
    const a: TechTreeTaskIdRow = { id: 'a', group_id: 'g1', sort_index: 1 }
    const b: TechTreeTaskIdRow = { id: 'b', group_id: 'g1', sort_index: 2 }
    const taskById = new Map<string, TechTreeTaskIdRow>([
      [a.id, a],
      [b.id, b],
    ])
    const ordered = new Map([['g1', ['a', 'b']]])
    const out = computeTaskReorderUpdates({
      activeId: 'a',
      overId: 'b',
      taskById,
      orderedIdsByGroup: ordered,
      allGroupIds: ['g1'],
    })
    expect(out).not.toBeNull()
    if (!out) return
    const byId = new Map(out.map((r) => [r.id, r]))
    expect(byId.get('a')?.sort_index).toBe(2)
    expect(byId.get('b')?.sort_index).toBe(1)
  })

  it('moves to empty group and assigns sort_index 1', () => {
    const t: TechTreeTaskIdRow = { id: 't1', group_id: 'g1', sort_index: 1 }
    const taskById = new Map<string, TechTreeTaskIdRow>([[t.id, t]])
    const ordered = new Map([
      ['g1', [t.id]],
      ['g2', [] as string[]],
    ])
    const out = computeTaskReorderUpdates({
      activeId: t.id,
      overId: techTreeEmptyGroupDropId('g2'),
      taskById,
      orderedIdsByGroup: ordered,
      allGroupIds: ['g1', 'g2'],
    })
    expect(out).not.toBeNull()
    if (!out) return
    const r = out.find((x) => x.id === t.id)
    expect(r?.group_id).toBe('g2')
    expect(r?.sort_index).toBe(1)
  })
})
