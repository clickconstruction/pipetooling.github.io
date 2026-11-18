import { describe, expect, it } from 'vitest'
import {
  HISTORY_GRID_MAX_DAYS,
  historyCellKey,
  historyCellStatus,
  historyGridDates,
  historyInstanceIndex,
  historyRateLabel,
  historyRowRate,
  historyShortDate,
  splitHistoryItems,
  type HistorySplitInstance,
} from './checklistHistorySplit'

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

describe('historyCellStatus', () => {
  it('reads an open row, a row this person finished and a row someone else finished', () => {
    expect(historyCellStatus({ completed_at: null, completed_by_user_id: null }, me)).toBe('incomplete')
    expect(historyCellStatus({ completed_at: '2026-06-11T20:00:00Z', completed_by_user_id: me }, me)).toBe('completed')
    expect(historyCellStatus({ completed_at: '2026-06-11T20:00:00Z', completed_by_user_id: 'user-wendi' }, me)).toBe('completed_by_other')
  })

  it('a finished row with nobody on it counts as this person’s', () => {
    expect(historyCellStatus({ completed_at: '2026-06-11T20:00:00Z', completed_by_user_id: null }, me)).toBe('completed')
  })
})

describe('historyGridDates', () => {
  it('lists every day a repeating row had, once, oldest first', () => {
    expect(
      historyGridDates([
        { dates: { '2026-06-12': 'incomplete', '2026-06-10': 'completed' } },
        { dates: { '2026-06-11': 'completed', '2026-06-12': 'completed_by_other' } },
      ]),
    ).toEqual(['2026-06-10', '2026-06-11', '2026-06-12'])
    expect(historyGridDates([])).toEqual([])
  })

  it('keeps the newest days when there are more than the grid draws', () => {
    const dates: Record<string, 'completed'> = {}
    for (let i = 1; i <= HISTORY_GRID_MAX_DAYS + 5; i++) dates[`2026-${String(Math.ceil(i / 28)).padStart(2, '0')}-${String(((i - 1) % 28) + 1).padStart(2, '0')}`] = 'completed'
    const all = Object.keys(dates).sort()
    const shown = historyGridDates([{ dates }])
    expect(shown).toHaveLength(HISTORY_GRID_MAX_DAYS)
    expect(shown).toEqual(all.slice(5))
  })
})

describe('historyRowRate and historyRateLabel', () => {
  const days = ['2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13']
  const dates = { '2026-06-10': 'completed', '2026-06-11': 'completed_by_other', '2026-06-12': 'incomplete' } as const

  it('a done day is due and done whoever did it, a missed day is due, a day with no row is neither', () => {
    expect(historyRowRate(dates, days)).toEqual({ due: 3, done: 2 })
    expect(historyRateLabel(historyRowRate(dates, days))).toBe('67%')
  })

  it('counts only the days the grid draws', () => {
    expect(historyRowRate(dates, ['2026-06-12', '2026-06-13'])).toEqual({ due: 1, done: 0 })
    expect(historyRateLabel({ due: 1, done: 0 })).toBe('0%')
  })

  it('a day whose row was just taken away counts as no row', () => {
    expect(historyRowRate(dates, days, (d) => d === '2026-06-12')).toEqual({ due: 2, done: 2 })
    expect(historyRateLabel({ due: 2, done: 2 })).toBe('100%')
  })

  it('says a dash when nothing was due', () => {
    expect(historyRowRate({}, days)).toEqual({ due: 0, done: 0 })
    expect(historyRateLabel({ due: 0, done: 0 })).toBe('—')
  })
})

describe('historyInstanceIndex', () => {
  it('finds the row behind a cell by task and day, and a later row for the same cell wins', () => {
    const index = historyInstanceIndex([inst('a', 'rep', '2026-06-10'), inst('b', 'rep', '2026-06-11'), inst('c', 'rep', '2026-06-10')])
    expect(historyCellKey('rep', '2026-06-10')).toBe('rep-2026-06-10')
    expect(index.get(historyCellKey('rep', '2026-06-10'))).toEqual({ id: 'c', checklist_item_id: 'rep', scheduled_date: '2026-06-10' })
    expect(index.get(historyCellKey('rep', '2026-06-11'))?.id).toBe('b')
    expect(index.get(historyCellKey('rep', '2026-06-12'))).toBeUndefined()
  })
})
