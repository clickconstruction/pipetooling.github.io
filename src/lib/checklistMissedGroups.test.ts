import { describe, expect, it } from 'vitest'
import { collapseMissedInstances } from './checklistMissedGroups'

const inst = (id: string, item: string, date: string) => ({ id, checklist_item_id: item, scheduled_date: date })

describe('collapseMissedInstances', () => {
  it('one group per item: oldest representative, all ids, newest date', () => {
    const groups = collapseMissedInstances([
      inst('a1', 'clean', '2026-02-17'),
      inst('a2', 'clean', '2026-02-18'),
      inst('a3', 'clean', '2026-02-19'),
      inst('b1', 'email', '2026-06-29'),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      count: 3,
      instanceIds: ['a1', 'a2', 'a3'],
      newestScheduledDate: '2026-02-19',
    })
    expect(groups[0]!.representative.id).toBe('a1')
    expect(groups[1]).toMatchObject({ count: 1, instanceIds: ['b1'] })
  })

  it('keeps first-seen item order (the person’s display order)', () => {
    const groups = collapseMissedInstances([
      inst('x1', 'second-item', '2026-05-01'),
      inst('y1', 'first-item', '2026-01-01'),
      inst('x2', 'second-item', '2026-05-02'),
    ])
    expect(groups.map((g) => g.representative.checklist_item_id)).toEqual(['second-item', 'first-item'])
  })

  it('out-of-order dates still pick the oldest representative and newest date', () => {
    const groups = collapseMissedInstances([
      inst('c2', 'clean', '2026-03-10'),
      inst('c1', 'clean', '2026-02-01'),
    ])
    expect(groups[0]!.representative.id).toBe('c1')
    expect(groups[0]!.newestScheduledDate).toBe('2026-03-10')
  })

  it('empty in, empty out', () => {
    expect(collapseMissedInstances([])).toEqual([])
  })
})
