import { describe, expect, it } from 'vitest'
import {
  dailysMarkNote,
  dailysNextLine,
  dailysOpenCount,
  dailysRows,
  parseDailyItems,
  setDailyItemRead,
  timeOffPeople,
  type DailysContext,
  type DailyItem,
} from './dailysRead'

const ITEMS: DailyItem[] = [
  { id: 's', label: 'Check for obvious schedule conflicts', reads: 'schedule' },
  { id: 'e', label: 'Is my email inbox clear?', reads: 'email-inbox' },
  { id: 'p', label: 'Is the physical inbox clear?', reads: 'physical-inbox' },
  { id: 't', label: 'Tell the lead about upcoming time off', reads: 'time-off' },
  { id: 'x', label: 'Water the plants' },
]

function ctx(over: Partial<DailysContext> = {}): DailysContext {
  return {
    todayYmd: '2026-10-26',
    checks: new Map(),
    marks: {},
    metrics: {},
    timeOff: [],
    ymdOf: (iso) => iso.slice(0, 10),
    timeOf: (iso) => iso.slice(11, 16),
    ...over,
  }
}

describe('parseDailyItems', () => {
  it('keeps a known read and drops an unknown one', () => {
    const raw = JSON.stringify([
      { id: 'a', label: 'A', reads: 'email-inbox' },
      { id: 'b', label: 'B', reads: 'banking' },
      { id: 'c', label: 'C' },
      { id: '', label: 'no id' },
    ])
    expect(parseDailyItems(raw)).toEqual([{ id: 'a', label: 'A', reads: 'email-inbox' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }])
    expect(parseDailyItems('not json')).toEqual([])
    expect(parseDailyItems(null)).toEqual([])
  })
})

describe('setDailyItemRead', () => {
  it('changes one box in place and returns null when nothing changes', () => {
    const next = setDailyItemRead(ITEMS, 'x', 'time-off')
    expect(next?.map((i) => i.reads)).toEqual(['schedule', 'email-inbox', 'physical-inbox', 'time-off', 'time-off'])
    expect(setDailyItemRead(ITEMS, 'x', '')).toBeNull()
    expect(setDailyItemRead(ITEMS, 'nope', 'schedule')).toBeNull()
    const cleared = setDailyItemRead(ITEMS, 'e', '')
    expect(cleared?.[1]).toEqual({ id: 'e', label: 'Is my email inbox clear?' })
  })
})

describe('timeOffPeople', () => {
  it('lists who is off in the window, soonest first, clipped to today, one line a person', () => {
    const people = timeOffPeople(
      [
        { user_id: 'u1', name: 'Jorge R.', start_date: '2026-10-29', end_date: '2026-10-30' },
        { user_id: 'u2', name: 'Tony V.', start_date: '2026-11-02', end_date: '2026-11-02' },
        { user_id: 'u3', name: 'Ana M.', start_date: '2026-10-20', end_date: '2026-10-27' },
        { user_id: 'u4', name: 'Late', start_date: '2026-11-20', end_date: '2026-11-21' },
        { user_id: 'u5', name: 'Gone', start_date: '2026-10-01', end_date: '2026-10-25' },
        { user_id: 'u1', name: 'Jorge R.', start_date: '2026-11-05', end_date: '2026-11-05' },
      ],
      '2026-10-26',
    )
    expect(people.map((p) => p.words)).toEqual(['Ana M. off Mon Oct 26 to Tue Oct 27', 'Jorge R. off Thu Oct 29 to Fri Oct 30', 'Tony V. off Mon Nov 2'])
  })
})

describe('dailysRows', () => {
  it('a station row is satisfied by that station\'s own mark today, and shows the live count', () => {
    const rows = dailysRows(
      ITEMS,
      ctx({
        marks: {
          schedule: { marked_at: '2026-10-26T13:52:00Z', marked_by_name: 'Marisol' },
          'email-inbox': { marked_at: '2026-10-25T14:00:00Z' },
        },
        metrics: { 'email-inbox': { count: 6, nextLine: 'Open Ridgeway Builders · 6 days' } },
      }),
    )
    expect(rows[0]).toMatchObject({ kind: 'station', station: 'schedule', satisfied: true, markedWords: 'marked today at 13:52 by Marisol', countWords: null })
    expect(rows[1]).toMatchObject({ kind: 'station', station: 'email-inbox', satisfied: false, markedWords: null, countWords: '6 open', nextLine: 'Open Ridgeway Builders · 6 days' })
    expect(rows[2]).toMatchObject({ kind: 'station', station: 'physical-inbox', satisfied: false, markedWords: null, countWords: null })
  })

  it('the time-off row is satisfied on its own when nobody is off, and by its tick otherwise', () => {
    const nobody = dailysRows(ITEMS, ctx())
    expect(nobody[3]).toMatchObject({ kind: 'time-off', satisfied: true, ticked: false, words: 'Nobody is off in the next 14 days.' })
    const someone = ctx({ timeOff: [{ user_id: 'u1', name: 'Jorge R.', start_date: '2026-10-29', end_date: '2026-10-30' }] })
    expect(dailysRows(ITEMS, someone)[3]).toMatchObject({ kind: 'time-off', satisfied: false, words: 'Jorge R. off Thu Oct 29 to Fri Oct 30' })
    const told = ctx({ ...someone, checks: new Map([['t', { checkedByName: 'Marisol', checkedAt: '2026-10-26T14:00:00Z' }]]) })
    expect(dailysRows(ITEMS, told)[3]).toMatchObject({ kind: 'time-off', satisfied: true, ticked: true })
  })

  it('a plain box is a tick', () => {
    const rows = dailysRows(ITEMS, ctx({ checks: new Map([['x', { checkedByName: null, checkedAt: '2026-10-26T14:00:00Z' }]]) }))
    expect(rows[4]).toEqual({ kind: 'tick', item: ITEMS[4], ticked: true, satisfied: true })
  })
})

describe('the count, the Next line and the note', () => {
  const full = ctx({
    marks: { schedule: { marked_at: '2026-10-26T13:52:00Z' }, 'physical-inbox': { marked_at: '2026-10-26T13:55:00Z', marked_by_name: 'Marisol' } },
    metrics: { 'email-inbox': { count: 6 }, 'physical-inbox': { count: 2 } },
    timeOff: [
      { user_id: 'u1', name: 'Jorge R.', start_date: '2026-10-29', end_date: '2026-10-30' },
      { user_id: 'u2', name: 'Tony V.', start_date: '2026-11-02', end_date: '2026-11-02' },
    ],
  })

  it('counts the rows not yet satisfied and names the first', () => {
    const rows = dailysRows(ITEMS, full)
    expect(dailysOpenCount(rows)).toBe(3)
    expect(dailysNextLine(rows)).toBe('Mark Email · 6 open')
    const emailMarked = dailysRows(ITEMS, { ...full, marks: { ...full.marks, 'email-inbox': { marked_at: '2026-10-26T15:00:00Z' } } })
    expect(dailysNextLine(emailMarked)).toBe('Tell the lead · Jorge R. off Thu Oct 29 to Fri Oct 30 · +1 more')
    const allButPlants = dailysRows(ITEMS, { ...full, marks: { ...full.marks, 'email-inbox': { marked_at: '2026-10-26T15:00:00Z' } }, checks: new Map([['t', { checkedByName: null, checkedAt: 'x' }]]) })
    expect(dailysNextLine(allButPlants)).toBe('Tick “Water the plants”')
    expect(dailysOpenCount(allButPlants)).toBe(1)
  })

  it('is null and zero when every row is satisfied', () => {
    const rows = dailysRows(ITEMS, {
      ...full,
      marks: { ...full.marks, 'email-inbox': { marked_at: '2026-10-26T15:00:00Z' } },
      checks: new Map([
        ['t', { checkedByName: null, checkedAt: 'x' }],
        ['x', { checkedByName: null, checkedAt: 'x' }],
      ]),
    })
    expect(dailysOpenCount(rows)).toBe(0)
    expect(dailysNextLine(rows)).toBeNull()
  })

  it('writes the note from the rows', () => {
    expect(dailysMarkNote(dailysRows(ITEMS, full))).toBe(
      'Schedule marked today at 13:52 · Email not marked (6 open) · Physical inbox marked today at 13:55 by Marisol (2 open) · time off: 2 people in the next 14 days, not told yet · Water the plants: open',
    )
    expect(dailysMarkNote([])).toBeNull()
    expect(dailysMarkNote(dailysRows([ITEMS[3]!], ctx()))).toBe('no time off coming up')
  })
})
