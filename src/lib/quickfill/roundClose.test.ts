import { describe, expect, it } from 'vitest'
import { officeRoundHeadline, officeRoundState, previousWorkdayYmd, ROUND_START_PRESS, ROUND_START_PRESS_WEEKEND, roundCloseSheet, roundCloseSummary, roundCloseTitle, roundStartPress, roundStartStation, roundStartWords, type RoundCloseEvent } from './roundClose'

// Central daylight time written as UTC (+5). Today is Friday 2026-10-23.
const TODAY = '2026-10-23'
function ev(ymd: string, hhmm: string, section_id: string, outstanding_count: number | null, outcome: string | null = null, who = 'Dana'): RoundCloseEvent {
  const [h, m] = hhmm.split(':').map(Number)
  return { section_id, marked_at: `${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`, outstanding_count, outcome, marked_by_name: who }
}
const label = (id: string) => ({ texts: 'Texts', 'billed-awaiting': 'Billed Awaiting Payment', prospects: 'Prospects', 'people-hours-new': 'People Hours', 'field-photos': 'Field photos → Drive' })[id] ?? id
const dayLabel = (ymd: string) => (ymd === '2026-10-22' ? 'Thursday' : ymd)

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

  it('the Dashboard card’s three states: today, not yet, and the morning after a miss', () => {
    const today = officeRoundState([ev(TODAY, '09:51', 'texts', 0, 'done')], TODAY, label)
    expect(today.kind).toBe('today')
    expect(officeRoundHeadline(today, dayLabel)).toBe('Today 9:51 AM · Dana · 1 station')

    const notYet = officeRoundState([ev('2026-10-22', '11:52', 'texts', 0, 'done'), ev('2026-10-22', '11:53', 'billed-awaiting', 9, 'worked')], TODAY, label)
    expect(notYet.kind).toBe('not-yet')
    expect(officeRoundHeadline(notYet, dayLabel)).toBe('No round yet today · Thursday 11:53 AM · 2 stations · 1 still open')

    const missed = officeRoundState([ev('2026-10-21', '09:17', 'texts', 0, 'done')], TODAY, label)
    expect(missed.kind).toBe('missed')
    expect(officeRoundHeadline(missed, dayLabel)).toBe('Last round 2026-10-21 9:17 AM · 1 stations')
    expect(officeRoundHeadline(officeRoundState([], TODAY, label), dayLabel)).toBe('')
    expect(previousWorkdayYmd('2026-10-26')).toBe('2026-10-23')
    expect(previousWorkdayYmd('2026-10-23')).toBe('2026-10-22')
  })

  it('today’s round starts on the station marked longest ago, and the card’s sentence ends in that station (the health rule)', () => {
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

    const start = roundStartStation(events, stations)
    const missed = officeRoundState([ev('2026-10-21', '09:17', 'texts', 0, 'done')], TODAY, label)
    expect(roundStartWords(missed, start, dayLabel)).toBe("The round did not run Thursday. Today's starts on Billed Awaiting Payment, marked last 2026-10-20.")
    expect(roundStartWords(missed, { sectionId: 'needs-you', label: "Today's lines", lastYmd: null }, dayLabel)).toBe("The round did not run Thursday. Today's starts on Today's lines, which has waited longest.")
    expect(roundStartWords(missed, null, dayLabel)).toBe('The round did not run Thursday. It opens on Quickfill.')
    const notYet = officeRoundState([ev('2026-10-22', '11:52', 'texts', 0, 'done')], TODAY, label)
    expect(roundStartWords(notYet, start, dayLabel)).toBe("The round has not started yet. Today's starts on Billed Awaiting Payment, marked last 2026-10-20.")
    const sunday = officeRoundState([ev('2026-10-23', '11:52', 'texts', 0, 'done')], '2026-10-25', label)
    expect(roundStartWords(sunday, start, dayLabel)).toBe('No round is due on the weekend.')
    expect(roundStartWords(officeRoundState([ev(TODAY, '09:51', 'texts', 0, 'done')], TODAY, label), start, dayLabel)).toBe('')
    expect(ROUND_START_PRESS).toBe("Start today's round")
    expect(roundStartPress(missed)).toBe(ROUND_START_PRESS)
    // A Saturday after a Friday with no marks: the round is not today's.
    const saturday = officeRoundState([ev('2026-10-21', '09:17', 'texts', 0, 'done')], '2026-10-24', label)
    expect(saturday).toMatchObject({ kind: 'missed', weekend: true, previousYmd: '2026-10-23' })
    expect(roundStartWords(saturday, start, dayLabel)).toBe('The round did not run 2026-10-23. The next round starts on Billed Awaiting Payment, marked last 2026-10-20.')
    expect(roundStartPress(saturday)).toBe(ROUND_START_PRESS_WEEKEND)
  })

  it('on a weekend the card says the last round, not that one has not started (v2.5868)', () => {
    const sunday = officeRoundState([ev('2026-10-23', '11:52', 'texts', 0, 'done'), ev('2026-10-23', '12:16', 'billed-awaiting', 50, 'worked')], '2026-10-25', label)
    expect(sunday).toMatchObject({ kind: 'not-yet', weekend: true, previousYmd: '2026-10-23' })
    expect(officeRoundHeadline(sunday, (ymd) => (ymd === '2026-10-23' ? 'Friday' : ymd))).toBe('Last round Friday 12:16 PM · 2 stations · 1 still open')
    const friday = officeRoundState([ev('2026-10-22', '11:52', 'texts', 0, 'done')], '2026-10-23', label)
    expect(friday).toMatchObject({ kind: 'not-yet', weekend: false })
  })
})
