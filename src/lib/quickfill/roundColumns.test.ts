import { describe, expect, it } from 'vitest'
import { roundColumnDays, roundColumnLabels, roundColumns, roundColumnsLine, roundColumnTitle, roundCountChipWords, shortDayLabel, type RoundColumn } from './roundColumns'
import type { RoundCloseEvent } from './roundClose'

// Central daylight time written as UTC (+5). Today is Friday 2026-10-30; the ten workdays run Mon Oct 19 to Fri Oct 30.
const TODAY = '2026-10-30'
function ev(ymd: string, hhmm: string, section_id: string, outstanding_count: number | null = 0, outcome: string | null = 'done', who = 'Dana'): RoundCloseEvent {
  const [h, m] = hhmm.split(':').map(Number)
  return { section_id, marked_at: `${ymd}T${String(h! + 5).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`, outstanding_count, outcome, marked_by_name: who }
}
const STATIONS = ['messages', 'warnings', 'people-hours-new', 'billed-awaiting', 'prospects']
/** Every station marked at `hhmm`, a minute apart. */
function fullDay(ymd: string, hhmm: string, who = 'Dana'): RoundCloseEvent[] {
  const [h, m] = hhmm.split(':').map(Number)
  return STATIONS.map((s, i) => ev(ymd, `${h}:${String(m! + i).padStart(2, '0')}`, s, 0, 'done', who))
}

const TEN_DAYS: RoundCloseEvent[] = [
  // A station marked before the window never counts toward the total.
  ev('2026-10-16', '09:00', 'office-leaving'),
  ...fullDay('2026-10-19', '09:30'),
  // A short Tuesday: three of five, Marisol pressed most.
  ev('2026-10-20', '09:40', 'messages', 0, 'done', 'Marisol'),
  ev('2026-10-20', '09:41', 'warnings', 2, 'worked', 'Marisol'),
  ev('2026-10-20', '09:44', 'people-hours-new', 25, 'worked', 'Dana'),
  ...fullDay('2026-10-21', '09:35'),
  ...fullDay('2026-10-22', '09:32'),
  ...fullDay('2026-10-23', '10:05'),
  ...fullDay('2026-10-26', '09:31'),
  ...fullDay('2026-10-27', '09:38'),
  ...fullDay('2026-10-28', '09:40'),
  // Thursday Oct 29: nothing. A miss.
  // Today so far: two stations, one still open, one a question.
  ev(TODAY, '09:50', 'messages', 4, 'worked'),
  ev(TODAY, '09:51', 'prospects', 268, 'question'),
]

describe('roundColumns · the office’s round as ten workday columns (punch list #217, office-5)', () => {
  it('the window is the last ten workdays, ending today on a workday and on Friday over a weekend', () => {
    expect(roundColumnDays(TODAY)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
    expect(roundColumnDays('2026-11-01')).toEqual(roundColumnDays(TODAY))
    expect(roundColumnDays('2026-11-02', 3)).toEqual(['2026-10-29', '2026-10-30', '2026-11-02'])
  })

  it('a full day, a short day, a miss and today in progress, each column the stations marked out of the stations the round visits', () => {
    const cols = roundColumns(TEN_DAYS, TODAY)
    expect(cols.total).toBe(5)
    expect(cols.columns).toHaveLength(10)
    expect(cols.columns.map((c) => c.marked)).toEqual([5, 3, 5, 5, 5, 5, 5, 5, 0, 2])
    expect(cols.columns.map((c) => c.miss)).toEqual([false, false, false, false, false, false, false, false, true, false])
    const monday = cols.columns[0]!
    expect(monday).toMatchObject({ ymd: '2026-10-19', fraction: 1, at: '9:34 AM', who: 'Dana', open: 0, questions: 0, today: false })
    const tuesday = cols.columns[1]!
    expect(tuesday).toMatchObject({ marked: 3, fraction: 0.6, at: '9:44 AM', who: 'Marisol', open: 2 })
    const thursday = cols.columns[8]!
    expect(thursday).toMatchObject({ ymd: '2026-10-29', marked: 0, fraction: 0, at: null, who: null, miss: true })
    const today = cols.columns[9]!
    expect(today).toMatchObject({ ymd: TODAY, marked: 2, fraction: 0.4, at: '9:51 AM', open: 1, questions: 1, miss: false, today: true })
    expect(cols.ran).toBe(8)
    expect(cols.missed).toBe(1)
    expect(cols.words).toBe('10 workdays, Mon, Oct 19 to today. The round ran on 8 days of 9. Missed Thu, Oct 29. Today 2 of 5 stations so far.')
  })

  it('today with no marks yet is not a miss, and on a weekend there is no today column', () => {
    const notYet = roundColumns(TEN_DAYS.filter((e) => !e.marked_at.startsWith(TODAY)), TODAY)
    expect(notYet.columns[9]).toMatchObject({ today: true, marked: 0, miss: false })
    expect(notYet.words).toContain('No round yet today.')
    const sunday = roundColumns(TEN_DAYS, '2026-11-01')
    expect(sunday.columns).toHaveLength(10)
    expect(sunday.columns.every((c) => !c.today)).toBe(true)
    expect(sunday.columns[9]).toMatchObject({ ymd: TODAY, marked: 2, miss: false })
    expect(sunday.words).toBe('10 workdays, Mon, Oct 19 to Fri, Oct 30. The round ran on 9 days of 10. Missed Thu, Oct 29.')
  })

  it('no events at all: ten misses, a total of zero and no height', () => {
    const cols = roundColumns([], TODAY)
    expect(cols.total).toBe(0)
    expect(cols.missed).toBe(9)
    expect(cols.columns.every((c) => c.fraction === 0)).toBe(true)
    expect(cols.words).toBe('10 workdays, Mon, Oct 19 to today. No round ran in these days. No round yet today.')
  })

  it('the labels: the first day, a Friday, the miss named, today; neighbours give way by rank', () => {
    const cols = roundColumns(TEN_DAYS, TODAY)
    // The miss on Thursday outranks today beside it, so *today* gives way and the miss keeps its date.
    expect(cols.labels).toEqual([
      { index: 0, text: 'Mon, Oct 19', kind: 'first', align: 'left' },
      { index: 4, text: 'Fri 23', kind: 'friday', align: 'center' },
      { index: 8, text: 'Thu 29 · no round', kind: 'miss', align: 'center' },
    ])
    // With Thursday run, today is labelled and right-aligned.
    const noMiss = roundColumns([...TEN_DAYS, ...fullDay('2026-10-29', '09:30')], TODAY)
    expect(noMiss.labels.map((l) => [l.index, l.text, l.align])).toEqual([
      [0, 'Mon, Oct 19', 'left'],
      [4, 'Fri 23', 'center'],
      [9, 'today', 'right'],
    ])
    // A Friday beside a miss gives way to the miss.
    const fridayMiss: RoundColumn[] = roundColumnDays(TODAY).map((ymd, i) => ({ ymd, marked: i === 3 ? 0 : 5, total: 5, fraction: i === 3 ? 0 : 1, at: null, who: null, open: 0, questions: 0, miss: i === 3, today: i === 9 }))
    expect(roundColumnLabels(fridayMiss).map((l) => [l.index, l.text])).toEqual([
      [0, 'Mon, Oct 19'],
      [3, 'Thu 22 · no round'],
      [9, 'today'],
    ])
    expect(shortDayLabel('2026-10-29')).toBe('Thu 29')
  })

  it('a column’s hover words', () => {
    const cols = roundColumns(TEN_DAYS, TODAY)
    expect(roundColumnTitle(cols.columns[1]!)).toBe('Tue, Oct 20 · 9:44 AM · Marisol · 3 of 5')
    expect(roundColumnTitle(cols.columns[8]!)).toBe('Thu, Oct 29 · no round')
    expect(roundColumnTitle(cols.columns[9]!)).toBe('Today · 9:51 AM · Dana · 2 of 5 so far')
    const notYet = roundColumns(TEN_DAYS.filter((e) => !e.marked_at.startsWith(TODAY)), TODAY)
    expect(roundColumnTitle(notYet.columns[9]!)).toBe('Today · no round yet')
  })

  it('the muted line under the strip, the old headline without its counts', () => {
    expect(roundColumnsLine(roundColumns(TEN_DAYS, TODAY), TODAY)).toBe('Today 9:51 AM · Dana · 2 of 5 stations')
    const clean = roundColumns([...TEN_DAYS.filter((e) => !e.marked_at.startsWith(TODAY)), ...fullDay(TODAY, '09:50')], TODAY)
    expect(roundColumnsLine(clean, TODAY)).toBe('Today 9:54 AM · Dana · 5 of 5 stations · every station clean')
    // No round yet today, after a Thursday that ran.
    const thursdayRan = roundColumns([...TEN_DAYS.filter((e) => !e.marked_at.startsWith(TODAY)), ...fullDay('2026-10-29', '09:30')], TODAY)
    expect(roundColumnsLine(thursdayRan, TODAY)).toBe('No round yet today · Thu, Oct 29 9:34 AM · 5 stations')
    // The morning after a miss.
    const missed = roundColumns(TEN_DAYS.filter((e) => !e.marked_at.startsWith(TODAY)), TODAY)
    expect(roundColumnsLine(missed, TODAY)).toBe('The round did not run Thu, Oct 29. The last round ran Wed, Oct 28 at 9:44 AM.')
    // A weekend reads the last round.
    expect(roundColumnsLine(roundColumns(TEN_DAYS, '2026-11-01'), '2026-11-01')).toBe('Last round Fri, Oct 30 9:51 AM · 2 stations')
    expect(roundColumnsLine(roundColumns([], TODAY), TODAY)).toBe('The round did not run Thu, Oct 29. No round ran in these 10 workdays.')
  })

  it('the chips’ words, none at zero', () => {
    expect(roundCountChipWords('open', 8)).toBe('still open 8')
    expect(roundCountChipWords('questions', 2)).toBe('questions 2')
    expect(roundCountChipWords('questions', 1)).toBe('question 1')
    expect(roundCountChipWords('open', 0)).toBe('')
  })
})
