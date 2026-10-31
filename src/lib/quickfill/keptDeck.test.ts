import { describe, expect, it } from 'vitest'
import {
  QUICKFILL_KEPT_MARKS_PER_STATION,
  buildQuickfillKeptRows,
  keptMarkedAtsBySection,
  quickfillDeckLoading,
  quickfillKeptCountLine,
  quickfillKeptDeckRows,
  quickfillKeptKey,
  quickfillKeptRowIsValid,
  quickfillStationReadsOn,
  type QuickfillKeptRow,
} from './keptDeck'
import { roundRows, type RoundEvent } from './round'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'

/**
 * Quickfill's kept deck (punch list #183 PR 4): the rows the Roller and the round keep on the
 * device, the deck drawn back from them against the clock, the count line, when the deck's read
 * is still out, and which stations' reads run on each view.
 */

const now = new Date('2026-10-31T14:00:00Z')
const daysAgo = (d: number, h = 0) => new Date(now.getTime() - d * 86_400_000 - h * 3_600_000).toISOString()

const sections = [
  { sectionId: 'needs-you', label: "Today's lines", personal: false, needsNote: false },
  { sectionId: 'messages', label: 'Messages', personal: false, needsNote: false },
  { sectionId: 'warnings', label: 'Warnings', personal: false, needsNote: false },
  { sectionId: 'my-inbox', label: 'My Inbox', personal: true, needsNote: false },
]
const marks = {
  'needs-you': { marked_at: daysAgo(0, 2), marked_by_name: 'Marisol' },
  messages: { marked_at: daysAgo(1, 1), marked_by_name: 'Marisol' },
  warnings: { marked_at: daysAgo(9), marked_by_name: 'Dana' },
}
const events: RoundEvent[] = [
  { section_id: 'needs-you', marked_at: daysAgo(0, 2), outstanding_count: 2 },
  { section_id: 'needs-you', marked_at: daysAgo(1, 2), outstanding_count: 1 },
  { section_id: 'messages', marked_at: daysAgo(1, 1), outstanding_count: 4 },
  { section_id: 'messages', marked_at: daysAgo(2, 1), outstanding_count: 3 },
  { section_id: 'messages', marked_at: daysAgo(3, 1), outstanding_count: 5 },
  { section_id: 'warnings', marked_at: daysAgo(9), outstanding_count: 0 },
  { section_id: 'warnings', marked_at: daysAgo(16), outstanding_count: 1 },
  { section_id: 'warnings', marked_at: daysAgo(23), outstanding_count: 0 },
  { section_id: 'warnings', marked_at: daysAgo(30), outstanding_count: 2 },
  { section_id: 'warnings', marked_at: daysAgo(37), outstanding_count: 0 },
  { section_id: 'warnings', marked_at: daysAgo(44), outstanding_count: 0 },
]
// Messages counted live this visit; the others draw the history's count.
const live = (id: string) => (id === 'messages' ? 6 : null)
const liveRows = () => roundRows(sections, marks, events, live, now)
const nextLineOf = (id: string) => (id === 'messages' ? 'Reply to Ridgeway Builders · waiting 3 days' : id === 'needs-you' ? 'Fill in the lost bid' : null)

describe('quickfillKeptKey', () => {
  it('is the person’s deck, one per device', () => {
    expect(quickfillKeptKey('u1')).toBe('u1:quickfill:deck')
    expect(quickfillKeptKey('u2')).not.toBe(quickfillKeptKey('u1'))
  })
})

describe('keptMarkedAtsBySection', () => {
  it('keeps each station’s last five marks, newest first', () => {
    const by = keptMarkedAtsBySection(events)
    expect(by.get('needs-you')).toEqual([daysAgo(0, 2), daysAgo(1, 2)])
    expect(by.get('warnings')).toHaveLength(QUICKFILL_KEPT_MARKS_PER_STATION)
    expect(by.get('warnings')?.[0]).toBe(daysAgo(9))
    expect(by.get('my-inbox')).toBeUndefined()
  })
})

describe('buildQuickfillKeptRows', () => {
  it('keeps the deck as drawn: the count with its source, the Next line of a station that counted, the last mark and the marks’ times', () => {
    const rows = buildQuickfillKeptRows({ rows: liveRows(), nextLineOf, markedAtsOf: keptMarkedAtsBySection(events) })
    const byId = new Map(rows.map((r) => [r.sectionId, r]))
    expect(byId.get('messages')).toMatchObject({ count: 6, countSource: 'open', nextLine: 'Reply to Ridgeway Builders · waiting 3 days', lastMarkedByName: 'Marisol' })
    // A station that did not count this visit carries the history’s count and no Next line, which the live row never had either.
    expect(byId.get('needs-you')).toMatchObject({ count: 2, countSource: 'last_look', nextLine: null })
    expect(byId.get('warnings')?.markedAts).toHaveLength(5)
    expect(byId.get('my-inbox')).toMatchObject({ personal: true, count: null, countSource: 'none', lastMarkedAt: null, markedAts: [] })
    expect(rows.map((r) => r.sectionId)).toEqual(liveRows().map((r) => r.sectionId))
  })
})

describe('quickfillKeptDeckRows', () => {
  const kept = () => buildQuickfillKeptRows({ rows: liveRows(), nextLineOf, markedAtsOf: keptMarkedAtsBySection(events) })

  it('draws the deck back as it was when read at the same moment: order, state, rhythm, counts and their sources', () => {
    const back = quickfillKeptDeckRows(kept(), now)
    const was = liveRows()
    expect(back.map((r) => r.sectionId)).toEqual(was.map((r) => r.sectionId))
    for (const [i, r] of back.entries()) {
      expect(r).toMatchObject({ state: was[i]!.state, rhythmDays: was[i]!.rhythmDays, count: was[i]!.count, countSource: was[i]!.countSource, lastMarkedByName: was[i]!.lastMarkedByName })
    }
  })

  it('re-asks the clock: a station fresh when kept is due again by evening, and the deck re-sorts', () => {
    const later = new Date(now.getTime() + 11 * 3_600_000)
    const back = quickfillKeptDeckRows(kept(), later)
    // Needs you was marked 2 h before `now`: fresh then, 13 h old now, and with two marks the flat rule says due today.
    expect(back.find((r) => r.sectionId === 'needs-you')?.state).toBe('due_today')
    expect(liveRows().find((r) => r.sectionId === 'needs-you')?.state).toBe('fresh')
    // Warnings (every 7 d, 9 d over) stays first; a personal door stays last.
    expect(back[0]?.sectionId).toBe('warnings')
    expect(back[back.length - 1]?.sectionId).toBe('my-inbox')
  })

  it('carries an at-last-look count whose mark is older than the history window on the last mark itself', () => {
    const row: QuickfillKeptRow = { sectionId: 'warnings', label: 'Warnings', personal: false, needsNote: false, count: 3, countSource: 'last_look', nextLine: null, lastMarkedAt: daysAgo(70), lastMarkedByName: null, markedAts: [] }
    expect(quickfillKeptDeckRows([row], now)[0]).toMatchObject({ count: 3, countSource: 'last_look', state: 'due' })
  })
})

describe('quickfillKeptRowIsValid', () => {
  const good: QuickfillKeptRow = { sectionId: 'messages', label: 'Messages', personal: false, needsNote: false, count: 6, countSource: 'open', nextLine: 'Reply', lastMarkedAt: daysAgo(1), lastMarkedByName: 'Marisol', markedAts: [daysAgo(1)] }
  it('takes a row of the shape, with nulls where the deck had none', () => {
    expect(quickfillKeptRowIsValid(good)).toBe(true)
    expect(quickfillKeptRowIsValid({ ...good, count: null, countSource: 'none', nextLine: null, lastMarkedAt: null, lastMarkedByName: null, markedAts: [] })).toBe(true)
  })
  it('refuses a row off the shape', () => {
    expect(quickfillKeptRowIsValid(null)).toBe(false)
    expect(quickfillKeptRowIsValid({ ...good, sectionId: '' })).toBe(false)
    expect(quickfillKeptRowIsValid({ ...good, countSource: 'live' })).toBe(false)
    expect(quickfillKeptRowIsValid({ ...good, count: '6' })).toBe(false)
    expect(quickfillKeptRowIsValid({ ...good, markedAts: [1] })).toBe(false)
    expect(quickfillKeptRowIsValid({ ...good, personal: 'no' })).toBe(false)
  })
})

describe('quickfillKeptCountLine', () => {
  const readAt = Date.UTC(2026, 9, 31, 12, 52) // 7:52 AM in Chicago
  const format = { timeZone: APP_CALENDAR_TZ }
  it('names the count and the time for a station that counted at the kept read', () => {
    expect(quickfillKeptCountLine({ count: 3, countSource: 'open' }, readAt, format)).toBe('3 open at 7:52 AM')
    expect(quickfillKeptCountLine({ count: 0, countSource: 'open' }, readAt, format)).toBe('0 open at 7:52 AM')
  })
  it('is empty for the history’s count or none, since the row already says at last look', () => {
    expect(quickfillKeptCountLine({ count: 3, countSource: 'last_look' }, readAt, format)).toBe('')
    expect(quickfillKeptCountLine({ count: null, countSource: 'none' }, readAt, format)).toBe('')
    expect(quickfillKeptCountLine(null, readAt, format)).toBe('')
  })
})

describe('quickfillDeckLoading', () => {
  const personal = (id: string) => id === 'my-inbox'
  const landed = { marksLoaded: true, eventsLoaded: true, layoutLoaded: true }
  it('is out while the marks, the history or the layout are', () => {
    const metricOf = () => ({ loading: false })
    expect(quickfillDeckLoading({ ...landed, marksLoaded: false, stationOnScreen: null, personal, metricOf })).toBe(true)
    expect(quickfillDeckLoading({ ...landed, eventsLoaded: false, stationOnScreen: null, personal, metricOf })).toBe(true)
    expect(quickfillDeckLoading({ ...landed, layoutLoaded: false, stationOnScreen: null, personal, metricOf })).toBe(true)
    expect(quickfillDeckLoading({ ...landed, stationOnScreen: null, personal, metricOf })).toBe(false)
  })
  it('waits for the on-screen station’s count: not registered or still counting is out, landed is in, a door never counts', () => {
    expect(quickfillDeckLoading({ ...landed, stationOnScreen: 'messages', personal, metricOf: () => undefined })).toBe(true)
    expect(quickfillDeckLoading({ ...landed, stationOnScreen: 'messages', personal, metricOf: () => ({ loading: true }) })).toBe(true)
    expect(quickfillDeckLoading({ ...landed, stationOnScreen: 'messages', personal, metricOf: () => ({ loading: false }) })).toBe(false)
    expect(quickfillDeckLoading({ ...landed, stationOnScreen: 'my-inbox', personal, metricOf: () => undefined })).toBe(false)
  })
})

describe('quickfillStationReadsOn', () => {
  it('runs every station’s read on the Page and in Focus, and only the on-screen station’s on the Roller and the round', () => {
    expect(quickfillStationReadsOn({ everyStationOnScreen: true, stationOnScreen: null, sectionId: 'messages' })).toBe(true)
    expect(quickfillStationReadsOn({ everyStationOnScreen: false, stationOnScreen: 'messages', sectionId: 'messages' })).toBe(true)
    expect(quickfillStationReadsOn({ everyStationOnScreen: false, stationOnScreen: 'messages', sectionId: 'property-kinds' })).toBe(false)
    expect(quickfillStationReadsOn({ everyStationOnScreen: false, stationOnScreen: null, sectionId: 'property-kinds' })).toBe(false)
  })
})
