import { describe, expect, it } from 'vitest'
import { officeRoundWeek, previousWorkdayYmd, ROUND_RED_FROM_WORKDAYS, ROUND_WEEK_WORDS, roundCellDay, roundCellTitle, roundCloseSheet, roundCloseSummary, roundCloseTitle, roundLeftLabel, roundStartStation, roundWeekPress, type RoundCloseEvent } from './roundClose'

// Central daylight time written as UTC (+5). Today is Friday 2026-10-23.
const TODAY = '2026-10-23'
function ev(ymd: string, hhmm: string, section_id: string, outstanding_count: number | null, outcome: string | null = null, who = 'Dana'): RoundCloseEvent {
  const [h, m] = hhmm.split(':').map(Number)
  return { section_id, marked_at: `${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`, outstanding_count, outcome, marked_by_name: who }
}
const label = (id: string) => ({ texts: 'Texts', 'billed-awaiting': 'Billed Awaiting Payment', prospects: 'Prospects', 'people-hours-new': 'People Hours', 'field-photos': 'Field photos → Drive' })[id] ?? id

describe('roundClose · the sheet at the end of the round (punch list #176, change 5)', () => {
  it('sorts the day’s last press per station into clean, still open, questions and looked, and times the round', () => {
    const sheet = roundCloseSheet(
      [
        ev(TODAY, '09:40', 'texts', 1, 'worked'),
        ev(TODAY, '09:51', 'texts', 0, 'done'),
        ev(TODAY, '09:42', 'billed-awaiting', 50, 'worked'),
        ev(TODAY, '09:44', 'prospects', 268, 'question'),
        ev(TODAY, '09:45', 'people-hours-new', 25, null),
        ev(TODAY, '09:46', 'field-photos', null, null),
        ev('2026-10-22', '11:00', 'texts', 3, 'worked'),
      ],
      TODAY,
      label,
    )
    expect(sheet.stations).toBe(5)
    expect(sheet.clean.map((l) => l.label)).toEqual(['Texts'])
    expect(sheet.open).toEqual([
      { sectionId: 'billed-awaiting', label: 'Billed Awaiting Payment', count: 50 },
      { sectionId: 'people-hours-new', label: 'People Hours', count: 25 },
    ])
    expect(sheet.questions).toEqual([{ sectionId: 'prospects', label: 'Prospects', count: 268 }])
    expect(sheet.looked.map((l) => l.label)).toEqual(['Field photos → Drive'])
    expect(sheet.at).toBe('9:51 AM')
    expect(sheet.startedAt).toBe('9:40 AM')
    expect(sheet.minutes).toBe(11)
    expect(sheet.who).toBe('Dana')
    expect(roundCloseTitle(sheet)).toBe('Round done · 9:51 AM · 5 stations')
    expect(roundCloseSummary(sheet)).toBe('1 clean · 2 worked and still open · 1 question for the owner · 1 looked')
  })

  it('an empty day is an empty sheet', () => {
    const sheet = roundCloseSheet([], TODAY, label)
    expect(sheet.stations).toBe(0)
    expect(sheet.at).toBeNull()
    expect(roundCloseSummary(sheet)).toBe('0 clean')
  })

  it('the Dashboard card is a week: five workdays and today, a missed day a hole (punch list #424)', () => {
    // Friday 2026-10-23. Mon and Tue ran, Wed and Thu did not, today has no mark yet.
    const week = officeRoundWeek(
      [
        ev('2026-10-16', '09:10', 'texts', 0, 'done'),
        ev('2026-10-19', '09:10', 'texts', 0, 'done'),
        ev('2026-10-19', '09:20', 'billed-awaiting', 9, 'worked'),
        ev('2026-10-19', '09:30', 'prospects', 4, 'question', 'Rosa'),
        ev('2026-10-19', '09:40', 'people-hours-new', 2, 'worked', 'Rosa'),
        ev('2026-10-20', '09:17', 'texts', 0, 'done'),
        ev('2026-10-20', '09:27', 'billed-awaiting', 50, 'worked'),
      ],
      TODAY,
      label,
    )
    expect(week.cells.map((c) => `${c.ymd.slice(8)} ${c.kind} ${c.looked}`)).toEqual(['16 ran 1', '19 ran 4', '20 ran 2', '21 missed 0', '22 missed 0', '23 today 0'])
    // A bar is that day against the fullest day drawn, since a round has no fixed count of stations.
    expect(week.cells.map((c) => c.fill)).toEqual([0.25, 1, 0.5, 0, 0, 0])
    expect(week.cells[1]!.who).toBe('Dana')
    expect(week).toMatchObject({ phase: 'not-started', missedInARow: 2, tone: 'amber' })
    // What the last round that ran left, since today's has not started.
    expect(week.left).toMatchObject({ ymd: '2026-10-20', today: false, at: '9:27 AM' })
    expect(week.left!.open.map((l) => `${l.label} ${l.count}`)).toEqual(['Billed Awaiting Payment 50'])
    expect(roundLeftLabel(week.left!)).toBe('Tue left')
    expect(roundWeekPress(week)).toBe('start')
    expect(week.cells.map(roundCellDay)).toEqual(['Fri 16', 'Mon 19', 'Tue 20', 'Wed 21', 'Thu 22', 'Today'])
    expect(roundCellTitle(week.cells[1]!)).toBe('Mon, Oct 19: 4 stations looked at, mostly by Dana.')
    expect(roundCellTitle(week.cells[3]!)).toBe('Wed, Oct 21: no round ran.')
    expect(roundCellTitle(week.cells[5]!)).toBe('Today: 0 stations looked at.')
    expect(previousWorkdayYmd('2026-10-26')).toBe('2026-10-23')
    expect(previousWorkdayYmd('2026-10-23')).toBe('2026-10-22')
  })

  it('one missed workday is amber, three in a row are red, and a mark today is green whatever came before', () => {
    expect(ROUND_RED_FROM_WORKDAYS).toBe(3)
    const ranYesterday = officeRoundWeek([ev('2026-10-22', '11:52', 'texts', 0, 'done')], TODAY, label)
    expect(ranYesterday).toMatchObject({ missedInARow: 0, tone: 'quiet', phase: 'not-started' })
    const one = officeRoundWeek([ev('2026-10-21', '09:17', 'texts', 0, 'done')], TODAY, label)
    expect(one).toMatchObject({ missedInARow: 1, tone: 'amber' })
    const three = officeRoundWeek([ev('2026-10-19', '09:17', 'texts', 0, 'done')], TODAY, label)
    expect(three).toMatchObject({ missedInARow: 3, tone: 'red' })
    // Nothing in the days drawn: every cell a hole, nothing left to show, and the count stops at the days drawn.
    const none = officeRoundWeek([], TODAY, label)
    expect(none).toMatchObject({ missedInARow: 5, tone: 'red', left: null })
    expect(none.cells.every((c) => c.fill === 0)).toBe(true)

    const started = officeRoundWeek([ev('2026-10-19', '09:17', 'texts', 0, 'done'), ev(TODAY, '09:40', 'billed-awaiting', 12, 'worked'), ev(TODAY, '09:44', 'prospects', 3, 'question')], TODAY, label)
    expect(started).toMatchObject({ phase: 'started', tone: 'green', missedInARow: 3 })
    expect(started.cells[5]).toMatchObject({ kind: 'today', looked: 2, who: 'Dana', fill: 1 })
    // Today's own leftovers once it has started, and a press that claims nothing about the round being done.
    expect(started.left).toMatchObject({ ymd: TODAY, today: true })
    expect(started.left!.questions.map((l) => l.label)).toEqual(['Prospects'])
    expect(roundLeftLabel(started.left!)).toBe(ROUND_WEEK_WORDS.leftToday)
    expect(roundWeekPress(started)).toBe('quickfill')
  })

  it('a weekend owes no round: today reads none due, and a missed Friday still shows (v2.5868)', () => {
    const sunday = officeRoundWeek([ev('2026-10-23', '11:52', 'texts', 0, 'done'), ev('2026-10-23', '12:16', 'billed-awaiting', 50, 'worked')], '2026-10-25', label)
    expect(sunday).toMatchObject({ phase: 'weekend', missedInARow: 0, tone: 'quiet' })
    expect(sunday.cells[5]).toMatchObject({ ymd: '2026-10-25', kind: 'off' })
    expect(roundCellDay(sunday.cells[5]!)).toBe('Sun')
    expect(roundCellTitle(sunday.cells[5]!)).toBe('Sun, Oct 25: no round is due.')
    expect(sunday.cells[4]).toMatchObject({ ymd: '2026-10-23', kind: 'ran', looked: 2 })
    expect(roundLeftLabel(sunday.left!)).toBe('Fri left')
    expect(roundWeekPress(sunday)).toBe('quickfill')
    // A Saturday after a Friday with no marks: the hole shows, and the press starts the round.
    const saturday = officeRoundWeek([ev('2026-10-21', '09:17', 'texts', 0, 'done')], '2026-10-24', label)
    expect(saturday).toMatchObject({ phase: 'weekend', missedInARow: 2, tone: 'amber' })
    expect(roundWeekPress(saturday)).toBe('start')
    // A mark on a Saturday is a round that day.
    expect(officeRoundWeek([ev('2026-10-24', '10:00', 'texts', 0, 'done')], '2026-10-24', label).cells[5]).toMatchObject({ kind: 'today', looked: 1 })
  })

  it('today’s round starts on the station marked longest ago (the health rule)', () => {
    const stations = [
      { sectionId: 'needs-you', label: "Today's lines" },
      { sectionId: 'texts', label: 'Texts' },
      { sectionId: 'billed-awaiting', label: 'Billed Awaiting Payment' },
    ]
    const events = [ev('2026-10-20', '09:10', 'billed-awaiting', 9, 'worked'), ev('2026-10-21', '09:17', 'texts', 0, 'done'), ev('2026-10-22', '11:52', 'texts', 0, 'done')]
    // Billed Awaiting Payment was marked longest ago; Today's lines, never marked in the window, is left out.
    expect(roundStartStation(events, stations)).toEqual({ sectionId: 'billed-awaiting', label: 'Billed Awaiting Payment', lastYmd: '2026-10-20' })
    // No mark on any station: the first in the round's order, with no day.
    expect(roundStartStation([], stations)).toEqual({ sectionId: 'needs-you', label: "Today's lines", lastYmd: null })
    expect(roundStartStation(events, [])).toBeNull()
    // A tie keeps the round's order.
    expect(roundStartStation([ev('2026-10-21', '09:00', 'billed-awaiting', 1, 'worked'), ev('2026-10-21', '09:30', 'texts', 0, 'done')], stations)?.sectionId).toBe('texts')
  })
})
