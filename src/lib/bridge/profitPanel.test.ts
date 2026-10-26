import { describe, expect, it } from 'vitest'
import { buildProfitPanel, type ProfitPanelInput } from './profitPanel'

const day = (entries: Array<[string, number]>): Map<string, number> => new Map(entries)

const base: ProfitPanelInput = {
  windowStart: '2026-09-27',
  todayYmd: '2026-10-10',
  earnedByDay: day([
    ['2026-09-28', 6000],
    ['2026-09-30', 6000],
    ['2026-10-05', 2000],
    ['2026-10-07', 2000],
  ]),
  directByDay: day([
    ['2026-09-28', 3000],
    ['2026-09-30', 3000],
    ['2026-10-05', 3000],
    ['2026-10-07', 3000],
  ]),
  overheadByDay: day([
    ['2026-09-29', 348],
    ['2026-10-06', 348],
  ]),
  speed: { days: 14, earnedPerDay: 1730, directPerDay: 3415, overheadPerDay: 348, climbPerDay: -2033 },
  contributionMargin: 0.27,
  totals: { earnedUsd: 274_000, fieldLaborUsd: 99_000, materialsUsd: 75_000, subLaborUsd: 25_000, overheadUsd: 18_000 },
  waitingWeeks: new Set(['2026-10-04']),
  pendingClosedHours: 585,
  unlinkedCard: 35,
  unattributedNoncard: 1151,
  fieldEarnedPerHour: 120,
  weekLabel: (s) => s,
}

describe('buildProfitPanel', () => {
  it('reads the weeks, the waterfall, the sources, break-even and the note', () => {
    const p = buildProfitPanel(base)
    expect(p.weeks.map((w) => [w.start, w.earnedUsd, w.costsUsd, w.netUsd, w.waiting])).toEqual([
      ['2026-09-27', 12_000, 6348, 5652, false],
      ['2026-10-04', 4000, 6348, -2348, true],
    ])
    expect(p.eightWeeks).toBe('2 weeks: earned $16.0k, costs $12.7k, net +$3.3k. 1 week made money; the one that did not is the one with hours waiting.')
    expect(p.waterfall).toEqual([
      { label: 'earned', usd: 1730, kind: 'step' },
      { label: 'jobs', usd: -3415, kind: 'step' },
      { label: 'overhead', usd: -348, kind: 'step' },
      { label: 'profit a day', usd: -2033, kind: 'total' },
    ])
    expect(p.sources.map((s) => [s.input, s.tone])).toEqual([
      ['earned', 'amber'],
      ['field labor', 'amber'],
      ['materials', 'amber'],
      ['subs', 'amber'],
      ['overhead', 'amber'],
    ])
    expect(p.sources[0]!.risk).toBe('585h not yet approved: reads low')
    expect(p.sources[2]!.risk).toBe('35 card purchases unsorted, 1,151 bank rows unsorted: reads low, or on the wrong job')
    expect(p.sources[1]!.from).toContain('50% of job costs')
    expect(p.breakEven).toBe('Break-even: overhead is $348 a day. At 27% margin the field must earn $1,289 a day to cover it. At its 2-week pace it earns $19,571 a day. The window’s pace covers the office.')
    expect(p.note).toBe(
      'The −$2,033 a day is a reading, not a result, and part of this is hours waiting: 585h are not yet approved, so the last 14 days earn on paper only what was approved. Approve them and the rate reads about $2,981 a day. Part can be materials bought ahead of the work — 38% of the window’s job costs is materials.',
    )
    expect(p.noteTone).toBe('amber')
  })
  it('reads a profitable day in green, with nothing waiting', () => {
    const p = buildProfitPanel({ ...base, speed: { ...base.speed, climbPerDay: 1900 }, pendingClosedHours: 0, unlinkedCard: 0, unattributedNoncard: 0, waitingWeeks: new Set() })
    expect(p.note).toBe('The day makes money at $1,900 on the 14-day average.')
    expect(p.noteTone).toBe('green')
    expect(p.sources[0]!.risk).toBe('read in full')
    expect(p.sources[2]!.risk).toBe('every purchase is sorted')
  })
})
