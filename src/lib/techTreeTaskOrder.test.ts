import { describe, expect, it } from 'vitest'
import { computeTaskReorderUpdates, techTreeEmptyGroupDropId, techTreeGroupDropId, type TechTreeTaskIdRow } from './techTreeTaskOrder'

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

  it('whole-box drop appends to the end of another group', () => {
    const a: TechTreeTaskIdRow = { id: 'a', group_id: 'g1', sort_index: 1 }
    const b: TechTreeTaskIdRow = { id: 'b', group_id: 'g1', sort_index: 2 }
    const x: TechTreeTaskIdRow = { id: 'x', group_id: 'g2', sort_index: 1 }
    const taskById = new Map<string, TechTreeTaskIdRow>([
      [a.id, a],
      [b.id, b],
      [x.id, x],
    ])
    const ordered = new Map([
      ['g1', ['a', 'b']],
      ['g2', ['x']],
    ])
    const out = computeTaskReorderUpdates({
      activeId: 'a',
      overId: techTreeGroupDropId('g2'),
      taskById,
      orderedIdsByGroup: ordered,
      allGroupIds: ['g1', 'g2'],
    })
    expect(out).not.toBeNull()
    if (!out) return
    const byId = new Map(out.map((r) => [r.id, r]))
    expect(byId.get('a')?.group_id).toBe('g2')
    expect(byId.get('a')?.sort_index).toBe(2)
    // source group closes the gap
    expect(byId.get('b')?.sort_index).toBe(1)
  })

  it('whole-box drop on the own group moves the task to the end', () => {
    const a: TechTreeTaskIdRow = { id: 'a', group_id: 'g1', sort_index: 1 }
    const b: TechTreeTaskIdRow = { id: 'b', group_id: 'g1', sort_index: 2 }
    const c: TechTreeTaskIdRow = { id: 'c', group_id: 'g1', sort_index: 3 }
    const taskById = new Map<string, TechTreeTaskIdRow>([
      [a.id, a],
      [b.id, b],
      [c.id, c],
    ])
    const ordered = new Map([['g1', ['a', 'b', 'c']]])
    const out = computeTaskReorderUpdates({
      activeId: 'a',
      overId: techTreeGroupDropId('g1'),
      taskById,
      orderedIdsByGroup: ordered,
      allGroupIds: ['g1'],
    })
    expect(out).not.toBeNull()
    if (!out) return
    const byId = new Map(out.map((r) => [r.id, r]))
    expect(byId.get('a')?.sort_index).toBe(3)
    expect(byId.get('b')?.sort_index).toBe(1)
    expect(byId.get('c')?.sort_index).toBe(2)
  })

  it('whole-box drop with an unknown task id is a no-op', () => {
    const out = computeTaskReorderUpdates({
      activeId: 'nope',
      overId: techTreeGroupDropId('g1'),
      taskById: new Map(),
      orderedIdsByGroup: new Map([['g1', [] as string[]]]),
      allGroupIds: ['g1'],
    })
    expect(out).toBeNull()
  })
})
