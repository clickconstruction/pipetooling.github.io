import { describe, expect, it } from 'vitest'
import { officeRoundHeadline, officeRoundState, previousWorkdayYmd, roundCloseSheet, roundCloseSummary, roundCloseTitle, type RoundCloseEvent } from './roundClose'

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
})
