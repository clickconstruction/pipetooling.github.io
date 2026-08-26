import { describe, expect, it } from 'vitest'
import {
  completedDayGroups,
  groupByDayDesc,
  overdueAgeLabel,
  qualifiesOutstanding,
  sortOutstanding,
  ledgerChip,
  ledgerDayLabel,
  ledgerStats,
  weekStartSunday,
  type LedgerInstance,
} from './checklistHistoryLedger'
import type { ChecklistCardEvent } from './checklistCardEvents'

function inst(partial: Partial<LedgerInstance> & { id: string; scheduled_date: string }): LedgerInstance {
  return {
    checklist_item_id: 'item-1',
    completed_at: null,
    completed_by_user_id: null,
    checklist_items: { title: 'Task' },
    ...partial,
  }
}

const TODAY = '2026-08-19'

describe('groupByDayDesc', () => {
  it('groups newest-first with done/due counts', () => {
    const days = groupByDayDesc([
      inst({ id: 'a', scheduled_date: '2026-08-18', completed_at: 'x' }),
      inst({ id: 'b', scheduled_date: '2026-08-19' }),
      inst({ id: 'c', scheduled_date: '2026-08-18' }),
    ])
    expect(days.map((d) => d.date)).toEqual(['2026-08-19', '2026-08-18'])
    expect(days[1]).toMatchObject({ doneCount: 1, dueCount: 2 })
  })
})

describe('ledgerChip', () => {
  it('done by the selected user carries the time', () => {
    const c = ledgerChip(inst({ id: 'a', scheduled_date: TODAY, completed_at: 'T1', completed_by_user_id: 'me' }), 'me', TODAY, [])
    expect(c).toEqual({ kind: 'done', completedAt: 'T1' })
  })

  it('done by someone else', () => {
    const c = ledgerChip(inst({ id: 'a', scheduled_date: TODAY, completed_at: 'T1', completed_by_user_id: 'other' }), 'me', TODAY, [])
    expect(c.kind).toBe('done_by_other')
  })

  it('incomplete today is open, incomplete yesterday is missed', () => {
    expect(ledgerChip(inst({ id: 'a', scheduled_date: TODAY }), 'me', TODAY, []).kind).toBe('open')
    expect(ledgerChip(inst({ id: 'a', scheduled_date: '2026-08-18' }), 'me', TODAY, []).kind).toBe('missed')
  })

  it('past incomplete whose last transition is a reopen reads reopened', () => {
    const events: ChecklistCardEvent[] = [
      { id: '1', instance_id: 'a', event_type: 'completed', actor_user_id: 'me', body: '', created_at: '1' },
      { id: '2', instance_id: 'a', event_type: 'reopened', actor_user_id: 'lead', body: '', created_at: '2' },
    ]
    expect(ledgerChip(inst({ id: 'a', scheduled_date: '2026-08-18' }), 'me', TODAY, events).kind).toBe('reopened')
  })
})

describe('ledgerStats', () => {
  const days = groupByDayDesc([
    inst({ id: 'a', scheduled_date: '2026-08-19', completed_at: 'x' }),
    inst({ id: 'b', scheduled_date: '2026-08-18', completed_at: 'x' }),
    inst({ id: 'c', scheduled_date: '2026-08-18', completed_at: 'x' }),
    inst({ id: 'd', scheduled_date: '2026-08-17' }),
    inst({ id: 'e', scheduled_date: '2026-08-14', completed_at: 'x' }),
  ])

  it('computes week pct over sun-to-today and missed count', () => {
    const s = ledgerStats(days, TODAY, '2026-08-16')
    // week window: 8/17 (0/1), 8/18 (2/2), 8/19 (1/1) => 3/4
    expect(s.weekPct).toBe(75)
    expect(s.missedCount).toBe(1)
  })

  it('streak counts back from today and stops at a missed day', () => {
    const s = ledgerStats(days, TODAY, '2026-08-16')
    // today all done (1) + yesterday all done (1) -> 8/17 missed stops it
    expect(s.streakDays).toBe(2)
  })

  it('an unfinished today does not break the streak', () => {
    const d2 = groupByDayDesc([
      inst({ id: 'a', scheduled_date: '2026-08-19' }),
      inst({ id: 'b', scheduled_date: '2026-08-18', completed_at: 'x' }),
    ])
    expect(ledgerStats(d2, TODAY, '2026-08-16').streakDays).toBe(1)
  })

  it('null weekPct when nothing was due this week', () => {
    const d2 = groupByDayDesc([inst({ id: 'a', scheduled_date: '2026-08-01', completed_at: 'x' })])
    expect(ledgerStats(d2, TODAY, '2026-08-16').weekPct).toBeNull()
  })
})

describe('labels', () => {
  it('today / yesterday / weekday', () => {
    expect(ledgerDayLabel('2026-08-19', TODAY)).toMatch(/^Today/)
    expect(ledgerDayLabel('2026-08-18', TODAY)).toMatch(/^Yesterday/)
    expect(ledgerDayLabel('2026-08-17', TODAY)).toMatch(/^Mon/)
  })

  it('week starts sunday', () => {
    expect(weekStartSunday('2026-08-19')).toBe('2026-08-16')
    expect(weekStartSunday('2026-08-16')).toBe('2026-08-16')
  })
})

describe('outstanding (v2.1864)', () => {
  it('qualifies one-offs and show-until-completed, not plain recurring', () => {
    expect(qualifiesOutstanding({ repeat_type: 'once', show_until_completed: false })).toBe(true)
    expect(qualifiesOutstanding({ repeat_type: 'day_of_week', show_until_completed: true })).toBe(true)
    expect(qualifiesOutstanding({ repeat_type: 'day_of_week', show_until_completed: false })).toBe(false)
    expect(qualifiesOutstanding(null)).toBe(false)
  })

  it('overdueAgeLabel formats due day and age', () => {
    expect(overdueAgeLabel('2026-07-30', '2026-08-19')).toMatch(/^due Thu, Jul 30 · 20 days ago$/)
    expect(overdueAgeLabel('2026-08-18', '2026-08-19')).toMatch(/1 day ago$/)
    expect(overdueAgeLabel('garbage', '2026-08-19')).toBe('due garbage')
  })

  it('sortOutstanding is most-overdue first, keyed on the effective due date (v2.2351)', () => {
    const rows = sortOutstanding([{ scheduled_date: '2026-03-19' }, { scheduled_date: '2026-07-30' }])
    expect(rows.map((r) => r.scheduled_date)).toEqual(['2026-03-19', '2026-07-30'])
  })

  it('sortOutstanding: a due date overrides the scheduled date as the key', () => {
    const rows = sortOutstanding([
      { scheduled_date: '2026-08-20', checklist_items: { due_date: '2026-09-04' } }, // in-window → sinks
      { scheduled_date: '2026-08-24' }, // late since the 24th
      { scheduled_date: '2026-08-25', checklist_items: { due_date: '2026-08-22' } }, // most late by due
    ])
    expect(rows.map((r) => r.checklist_items?.due_date || r.scheduled_date)).toEqual(['2026-08-22', '2026-08-24', '2026-09-04'])
  })

  it('completedDayGroups drops incomplete rows and empty days', () => {
    const days = completedDayGroups([
      inst({ id: 'a', scheduled_date: '2026-08-18', completed_at: 'x' }),
      inst({ id: 'b', scheduled_date: '2026-08-18' }),
      inst({ id: 'c', scheduled_date: '2026-08-17' }),
    ])
    expect(days).toHaveLength(1)
    expect(days[0]).toMatchObject({ date: '2026-08-18', dueCount: 1, doneCount: 1 })
  })
})
