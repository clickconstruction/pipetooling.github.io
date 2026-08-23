import { describe, expect, it } from 'vitest'
import { goalsLedgerTaskRows } from './roadmapGoalsLedger'

describe('goalsLedgerTaskRows', () => {
  // stage order deliberately disagrees with insertion order to prove numbering follows sort_index
  const groups = [
    { id: 'trail', title: 'Cut trail', sort_index: 2 },
    { id: 'tools', title: 'Tools', sort_index: 1 },
    { id: 'goal', title: 'Full Use of Land', sort_index: 3 },
  ]
  const edges = [
    { fromGroupId: 'tools', toGroupId: 'goal' },
    { fromGroupId: 'trail', toGroupId: 'goal' },
  ]
  const tasks = [
    { id: 'b', group_id: 'trail', title: 'install gate', sort_index: 2, completed_at: null, pinned_at: '2026-08-23T00:00:00Z', assigneeIds: [] },
    { id: 'a', group_id: 'trail', title: 'cut trail', sort_index: 1, completed_at: '2026-08-20T00:00:00Z', assigneeIds: ['u1'] },
    { id: 'c', group_id: 'trail', title: 'cut by hand', sort_index: 3, completed_at: null, assigneeIds: [] },
    { id: 't1', group_id: 'tools', title: 'pegboard', sort_index: 1, completed_at: null, assigneeIds: ['u1', 'ghost'] },
  ]
  const nameById = new Map([['u1', 'Robert']])
  const bridge = new Map([['b', { instanceCompletedAt: null, reviewedAt: null }]])

  it('numbers tasks from the sort_index stage order and task order', () => {
    const rows = goalsLedgerTaskRows({ groups, tasks, edges, nameById, bridgeByTaskId: bridge })
    expect(rows.get('trail')!.map((r) => `${r.number} ${r.title}`)).toEqual(['2.1 cut trail', '2.2 install gate', '2.3 cut by hand'])
    expect(rows.get('tools')!.map((r) => r.number)).toEqual(['1.1'])
    expect(rows.has('goal')).toBe(false) // task-less milestone has no rows
  })

  it('carries done / pinned / next-up / names / bridge chip', () => {
    const rows = goalsLedgerTaskRows({ groups, tasks, edges, nameById, bridgeByTaskId: bridge })
    const [a, b, c] = rows.get('trail')!
    expect(a).toMatchObject({ done: true, assigneeNames: ['Robert'], chip: null })
    expect(b).toMatchObject({ done: false, pinned: true, nextUp: true, chip: 'on_list', assigneeNames: [] })
    expect(c).toMatchObject({ done: false, pinned: false, nextUp: true })
    expect(rows.get('tools')![0]!.assigneeNames).toEqual(['Robert', '…'])
  })

  it('tasks outside the roadmap are ignored', () => {
    const rows = goalsLedgerTaskRows({ groups, tasks: [...tasks, { id: 'x', group_id: 'elsewhere', title: 'x', sort_index: 1, completed_at: null, assigneeIds: [] }], edges, nameById })
    expect([...rows.keys()].sort()).toEqual(['tools', 'trail'])
  })
})
