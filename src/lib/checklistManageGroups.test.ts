import { describe, expect, it } from 'vitest'
import {
  bucketManageItems,
  deriveItemInstanceStats,
  isItemCompleteFrom,
  isRepeatingItem,
  isScheduledAhead,
  nextOccurrenceLabel,
  openAgeLabel,
  repeatChipLabel,
} from './checklistManageGroups'

describe('repeatChipLabel', () => {
  it('until completed wins', () => {
    expect(repeatChipLabel({ show_until_completed: true, repeat_type: 'day_of_week' })).toBe('until completed')
  })
  it('weekly days abbreviate; all seven collapses', () => {
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [1, 3, 5] })).toBe('Mon Wed Fri')
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [0, 1, 2, 3, 4, 5, 6] })).toBe('Every day')
    expect(repeatChipLabel({ repeat_type: 'day_of_week', repeat_days_of_week: [] })).toBe('weekly')
  })
  it('after-completion cadence', () => {
    expect(repeatChipLabel({ repeat_type: 'days_after_completion', repeat_days_after: 7 })).toBe('7 days after done')
    expect(repeatChipLabel({ repeat_type: 'days_after_completion', repeat_days_after: 1 })).toBe('1 day after done')
  })
  it('once fallback', () => {
    expect(repeatChipLabel({ repeat_type: 'once' })).toBe('once')
  })
})

describe('openAgeLabel', () => {
  it('formats ages and handles empty', () => {
    expect(openAgeLabel('2026-03-22', '2026-08-19')).toBe('open 150 days')
    expect(openAgeLabel('2026-08-18', '2026-08-19')).toBe('open 1 day')
    expect(openAgeLabel('2026-08-19', '2026-08-19')).toBe('open today')
    expect(openAgeLabel(undefined, '2026-08-19')).toBe('')
  })
  it('future dates say when the task starts, not "open today" (v2.2346)', () => {
    expect(openAgeLabel('2026-08-31', '2026-08-26')).toBe('starts Mon, Aug 31')
    expect(openAgeLabel('2026-08-27', '2026-08-26')).toBe('starts Thu, Aug 27')
  })
})

describe('isScheduledAhead', () => {
  it('true only for a strictly future earliest-open date', () => {
    expect(isScheduledAhead('2026-08-31', '2026-08-26')).toBe(true)
    expect(isScheduledAhead('2026-08-26', '2026-08-26')).toBe(false)
    expect(isScheduledAhead('2026-08-20', '2026-08-26')).toBe(false)
    expect(isScheduledAhead(undefined, '2026-08-26')).toBe(false)
  })
})

describe('nextOccurrenceLabel', () => {
  it('names the next day, says due today for today, empty when none', () => {
    expect(nextOccurrenceLabel('2026-08-24', '2026-08-21')).toBe('next Mon, Aug 24')
    expect(nextOccurrenceLabel('2026-08-21', '2026-08-21')).toBe('due today')
    expect(nextOccurrenceLabel(undefined, '2026-08-21')).toBe('')
  })
})

describe('isRepeatingItem', () => {
  it('weekly and after-completion tasks repeat; once and until-completed do not', () => {
    expect(isRepeatingItem({ repeat_type: 'day_of_week' })).toBe(true)
    expect(isRepeatingItem({ repeat_type: 'days_after_completion' })).toBe(true)
    expect(isRepeatingItem({ repeat_type: 'once' })).toBe(false)
    expect(isRepeatingItem({ repeat_type: 'day_of_week', show_until_completed: true })).toBe(false)
    expect(isRepeatingItem({})).toBe(false)
  })
})

describe('deriveItemInstanceStats', () => {
  const rows = [
    { checklist_item_id: 'a', completed_at: '2026-08-01T12:00:00Z', scheduled_date: '2026-08-01' },
    { checklist_item_id: 'a', completed_at: null, scheduled_date: '2026-08-10' },
    { checklist_item_id: 'a', completed_at: null, scheduled_date: '2026-08-03' },
    { checklist_item_id: 'a', completed_at: null, scheduled_date: '2026-08-24' },
    { checklist_item_id: 'a', completed_at: null, scheduled_date: '2026-08-21' },
    { checklist_item_id: 'b', completed_at: '2026-08-02T12:00:00Z', scheduled_date: '2026-08-02' },
  ]
  const stats = deriveItemInstanceStats(rows, '2026-08-19')

  it('counts each task’s days and says whether one is open', () => {
    expect(stats.completion.get('a')).toEqual({ total: 5, hasIncomplete: true })
    expect(stats.completion.get('b')).toEqual({ total: 1, hasIncomplete: false })
    expect(stats.completion.get('c')).toBeUndefined()
  })

  it('keeps the oldest open day, whatever order the rows came in', () => {
    expect(stats.oldestOpen.get('a')).toBe('2026-08-03')
    expect(stats.oldestOpen.has('b')).toBe(false)
  })

  it('keeps the soonest open day from today on, and today counts', () => {
    expect(stats.nextOpen.get('a')).toBe('2026-08-21')
    expect(deriveItemInstanceStats(rows, '2026-08-21').nextOpen.get('a')).toBe('2026-08-21')
    expect(deriveItemInstanceStats(rows, '2026-08-25').nextOpen.has('a')).toBe(false)
  })

  it('a task is complete only with at least one day and none open', () => {
    expect(isItemCompleteFrom(stats.completion.get('a'))).toBe(false)
    expect(isItemCompleteFrom(stats.completion.get('b'))).toBe(true)
    expect(isItemCompleteFrom(undefined)).toBe(false)
    expect(isItemCompleteFrom({ total: 0, hasIncomplete: false })).toBe(false)
  })
})

describe('bucketManageItems', () => {
  const item = (id: string, over: Partial<{ repeat_type: string; show_until_completed: boolean; created_at: string | null }> = {}) => ({
    id,
    repeat_type: 'once',
    show_until_completed: false,
    created_at: '2026-08-01T12:00:00Z' as string | null,
    ...over,
  })
  const items = [
    item('new-open', { created_at: '2026-08-15T12:00:00Z' }),
    item('old-open', { created_at: '2026-08-10T12:00:00Z' }),
    item('no-day', { created_at: '2026-06-01T12:00:00Z' }),
    item('ahead-far', { created_at: '2026-08-12T12:00:00Z' }),
    item('ahead-soon', { created_at: '2026-08-11T12:00:00Z' }),
    item('done-old', { created_at: '2026-07-01T12:00:00Z' }),
    item('done-new', { created_at: '2026-07-20T12:00:00Z' }),
    item('weekly', { repeat_type: 'day_of_week', created_at: '2026-05-01T12:00:00Z' }),
    item('after', { repeat_type: 'days_after_completion', created_at: null }),
    item('until', { repeat_type: 'day_of_week', show_until_completed: true, created_at: '2026-08-14T12:00:00Z' }),
  ]
  const completion = new Map([
    ['new-open', { total: 1, hasIncomplete: true }],
    ['old-open', { total: 1, hasIncomplete: true }],
    ['ahead-far', { total: 1, hasIncomplete: true }],
    ['ahead-soon', { total: 1, hasIncomplete: true }],
    ['done-old', { total: 1, hasIncomplete: false }],
    ['done-new', { total: 2, hasIncomplete: false }],
    ['weekly', { total: 9, hasIncomplete: false }],
    ['until', { total: 1, hasIncomplete: true }],
  ])
  const oldestOpen = new Map([
    ['new-open', '2026-08-15'],
    ['old-open', '2026-03-22'],
    ['ahead-far', '2026-09-30'],
    ['ahead-soon', '2026-08-31'],
    ['until', '2026-08-14'],
  ])
  const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id)
  const parts = bucketManageItems(items, completion, oldestOpen, '2026-08-19')

  it('open one-offs lead with the oldest open day; a task with no day yet falls back to the day it was made', () => {
    expect(ids(parts.openOneOffs)).toEqual(['old-open', 'no-day', 'until', 'new-open'])
  })

  it('a one-off whose first open day is ahead waits in its own part, soonest first', () => {
    expect(ids(parts.scheduledOneOffs)).toEqual(['ahead-soon', 'ahead-far'])
  })

  it('every one-off not finished is counted once, newest made first', () => {
    expect(ids(parts.incompleteItems)).toEqual(['new-open', 'until', 'ahead-far', 'ahead-soon', 'old-open', 'no-day'])
  })

  it('repeating and finished tasks come newest made first, and a repeating task is never called complete', () => {
    expect(ids(parts.repeatingItems)).toEqual(['weekly', 'after'])
    expect(ids(parts.completeItems)).toEqual(['done-new', 'done-old'])
  })

  it('does not reorder the list it was handed', () => {
    expect(ids(items)[0]).toBe('new-open')
    expect(ids(items)[9]).toBe('until')
  })
})
