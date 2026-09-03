import { describe, expect, it } from 'vitest'
import { buildReviewTasksRollup, cadenceLabel, type ReviewOutstandingTaskInput } from './reviewTasksRollup'

function weekly(itemId: string, title: string, from: string, n: number): ReviewOutstandingTaskInput[] {
  const out: ReviewOutstandingTaskInput[] = []
  const [y, m, d] = from.split('-').map(Number) as [number, number, number]
  for (let i = 0; i < n; i += 1) {
    const dt = new Date(Date.UTC(y, m - 1, d + i * 7))
    out.push({ id: `${itemId}-${i}`, title, scheduled_date: dt.toISOString().slice(0, 10), checklist_item_id: itemId })
  }
  return out
}

describe('cadenceLabel', () => {
  it('names the common gaps', () => {
    expect(cadenceLabel(1)).toBe('daily')
    expect(cadenceLabel(7)).toBe('weekly')
    expect(cadenceLabel(14)).toBe('every two weeks')
    expect(cadenceLabel(30)).toBe('monthly')
    expect(cadenceLabel(10)).toBe('every 10 days')
  })
})

describe('buildReviewTasksRollup', () => {
  it('collapses a recurring item into one line with missed / upcoming counts and keeps one-offs', () => {
    const tasks = [
      ...weekly('item-1', 'Review PipeTooling Jobs', '2026-02-18', 34),
      { id: 'a', title: 'Throw away the old plans', scheduled_date: '2026-08-25', checklist_item_id: 'item-2' },
      { id: 'b', title: 'Install the gate', scheduled_date: '2026-08-20', checklist_item_id: 'item-3' },
    ]
    const out = buildReviewTasksRollup(tasks, '2026-09-03')
    expect(out.total).toBe(36)
    expect(out.lines).toHaveLength(3)
    const rec = out.lines[0]!
    expect(rec.kind).toBe('recurring')
    if (rec.kind !== 'recurring') throw new Error('expected recurring')
    expect(rec).toMatchObject({
      title: 'Review PipeTooling Jobs',
      cadence: 'weekly',
      count: 34,
      missed: 29,
      upcoming: 5,
      firstMissed: '2026-02-18',
      lastMissed: '2026-09-02',
      nextDue: '2026-09-09',
    })
    // One-offs are ordered by their own date after the recurring line's first miss.
    expect(out.lines.slice(1).map((l) => (l.kind === 'single' ? l.task.id : ''))).toEqual(['b', 'a'])
  })
  it('does not collapse below the minimum instance count, and falls back to the title when there is no item id', () => {
    const two = weekly('item-9', 'Twice', '2026-08-01', 2)
    expect(buildReviewTasksRollup(two, '2026-09-03').lines.every((l) => l.kind === 'single')).toBe(true)
    const byTitle = weekly('', 'Same title', '2026-08-01', 4).map((t) => ({ ...t, checklist_item_id: null }))
    const out = buildReviewTasksRollup(byTitle, '2026-09-03')
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0]!.kind).toBe('recurring')
  })
  it('treats today as upcoming, not missed', () => {
    const tasks = weekly('i', 'T', '2026-08-20', 3) // 08-20, 08-27, 09-03
    const out = buildReviewTasksRollup(tasks, '2026-09-03')
    const rec = out.lines[0]!
    if (rec.kind !== 'recurring') throw new Error('expected recurring')
    expect(rec.missed).toBe(2)
    expect(rec.upcoming).toBe(1)
    expect(rec.nextDue).toBe('2026-09-03')
  })
})
