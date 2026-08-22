import { describe, expect, it } from 'vitest'
import { historyShortDate, splitHistoryItems, type HistorySplitInstance } from './checklistHistorySplit'

const me = 'user-taunya'
const inst = (
  id: string,
  itemId: string,
  scheduled: string,
  over: Partial<HistorySplitInstance> = {},
  item: Partial<NonNullable<HistorySplitInstance['checklist_items']>> = {},
): HistorySplitInstance => ({
  id,
  checklist_item_id: itemId,
  scheduled_date: scheduled,
  completed_at: null,
  completed_by_user_id: null,
  checklist_items: { title: `t-${itemId}`, repeat_type: 'daily', created_at: null, ...item },
  ...over,
})

describe('splitHistoryItems', () => {
  it('separates repeating from one-off and misses nothing', () => {
    const rows = splitHistoryItems(
      [
        inst('a', 'rep', '2026-06-10'),
        inst('b', 'rep', '2026-06-11', { completed_at: '2026-06-11T20:00:00Z' }),
        inst('c', 'one', '2026-06-12', {}, { repeat_type: 'once' }),
        inst('d', 'null-rt', '2026-06-13', {}, { repeat_type: null }),
      ],
      me,
      '2026-08-22',
    )
    expect(rows.repeating.map((r) => r.itemId)).toEqual(['rep'])
    expect(rows.oneOffs.map((o) => o.itemId).sort()).toEqual(['null-rt', 'one'])
    expect(rows.repeating[0]!.dates).toEqual({ '2026-06-10': 'incomplete', '2026-06-11': 'completed' })
  })

  it('row birth is the earlier of item created day and first instance', () => {
    const rows = splitHistoryItems(
      [
        inst('a', 'rep', '2026-06-20', {}, { created_at: '2026-06-14T15:00:00Z' }),
        inst('b', 'rep', '2026-06-21', {}, { created_at: '2026-06-14T15:00:00Z' }),
      ],
      me,
      '2026-08-22',
    )
    expect(rows.repeating[0]!.sinceYmd).toBe('2026-06-14')
    // Backfilled instance before created_at wins.
    const back = splitHistoryItems([inst('a', 'rep', '2026-06-01', {}, { created_at: '2026-06-14T15:00:00Z' })], me, '2026-08-22')
    expect(back.repeating[0]!.sinceYmd).toBe('2026-06-01')
  })

  it('one-off statuses: done, done by other, missed, open — newest created first', () => {
    const rows = splitHistoryItems(
      [
        inst('a', 'i1', '2026-08-01', { completed_at: '2026-08-02T12:00:00Z' }, { repeat_type: 'once', created_at: '2026-07-30T12:00:00Z' }),
        inst('b', 'i2', '2026-08-05', { completed_at: '2026-08-06T12:00:00Z', completed_by_user_id: 'someone' }, { repeat_type: 'once', created_at: '2026-08-04T12:00:00Z' }),
        inst('c', 'i3', '2026-07-01', {}, { repeat_type: 'once', created_at: '2026-06-28T12:00:00Z' }),
        inst('d', 'i4', '2026-08-22', {}, { repeat_type: 'once', created_at: '2026-08-20T12:00:00Z' }),
      ],
      me,
      '2026-08-22',
    )
    expect(rows.oneOffs.map((o) => [o.itemId, o.status])).toEqual([
      ['i4', 'open'],
      ['i2', 'done_by_other'],
      ['i1', 'done'],
      ['i3', 'missed'],
    ])
    expect(rows.oneOffs[2]!.completedYmd).toBe('2026-08-02')
  })
})

describe('historyShortDate', () => {
  it('renders M/D without zero padding', () => {
    expect(historyShortDate('2026-06-09')).toBe('6/9')
    expect(historyShortDate('2026-12-25')).toBe('12/25')
  })
})
