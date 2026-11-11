import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
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
  fieldMadePerHour: 120,
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
  it('puts the warning first while hours wait, with about what the day reads once they are in (v2.6840)', () => {
    const p = buildProfitPanel(base)
    expect(p.left).toEqual({ usd: -2033, days: 14, approx: false })
    expect(p.reading).toBe('approved')
    expect(p.warn).toBe('Reads low for now. 585 hours still wait on approval. With them it reads about $2,981 a day.')
    expect(plainWordsFailures(p.warn ?? '')).toEqual([])
    // One hour, and no rate to price it with.
    expect(buildProfitPanel({ ...base, pendingClosedHours: 1, fieldMadePerHour: null }).warn).toBe('Reads low for now. 1 hour still waits on approval.')
    // Nothing waiting: no warning at all.
    expect(buildProfitPanel({ ...base, pendingClosedHours: 0 }).warn).toBeNull()
  })

  // v2.6965: the page passes maps that already count the waiting hours, and says how many and what approved hours alone read.
  describe('on recorded time', () => {
    const recorded: ProfitPanelInput = { ...base, speed: { ...base.speed, earnedPerDay: 4700, directPerDay: 3600, climbPerDay: 752 }, waiting: { hours: 93.4, approvedLeftUsd: -2033 } }

    it('leads with the day’s figure marked ≈, then says what is counted and what approved hours alone read', () => {
      const p = buildProfitPanel(recorded)
      expect(p.reading).toBe('recorded')
      expect(p.left).toEqual({ usd: 752, days: 14, approx: true })
      expect(p.warn).toBe('Counts 93 hours that still wait on approval. On approved hours alone it reads −$2,033 a day.')
      expect(plainWordsFailures(p.warn ?? '')).toEqual([])
      // The hours the words name are the waiting field hours the figures count, not every hour that waits.
      expect(p.sources[0]!.from).toBe('recorded field hours × the job’s contract ÷ its expected hours')
      expect(p.sources[0]!.risk).toBe('93h not yet approved: counted, and can change')
      expect(p.sources[1]!.from).toContain('and each person’s wage on the hours waiting')
      expect(p.sources[1]!.risk).toBe('the same hours: counted, and can change')
      expect(p.sources.slice(0, 2).map((s) => s.tone)).toEqual(['amber', 'amber'])
      expect(p.note).toBe('The day makes money at $752 on the 14-day average, counting 93h still waiting on approval.')
      expect(p.noteTone).toBe('green')
    })

    it('says one hour as one hour', () => {
      expect(buildProfitPanel({ ...recorded, waiting: { hours: 1, approvedLeftUsd: 700 } }).warn).toBe('Counts 1 hour that still waits on approval. On approved hours alone it reads $700 a day.')
    })

    it('drops the second sentence and the ≈ when the waiting hours fall outside the average’s days', () => {
      const p = buildProfitPanel({ ...recorded, waiting: { hours: 12, approvedLeftUsd: 752.4 } })
      expect(p.left.approx).toBe(false)
      expect(p.warn).toBe('Counts 12 hours that still wait on approval.')
    })

    it('reads as settled when nothing waits: no line, no ≈, the sources read in full', () => {
      const p = buildProfitPanel({ ...recorded, pendingClosedHours: 40, waiting: { hours: 0, approvedLeftUsd: 752 } })
      expect(p.reading).toBe('recorded')
      expect(p.warn).toBeNull()
      expect(p.left.approx).toBe(false)
      // Hours that wait but are not field hours in the window (office, bid, older) are not this panel's to name.
      expect(p.sources.slice(0, 2).map((s) => [s.risk, s.tone])).toEqual([
        ['read in full', 'green'],
        ['read in full', 'green'],
      ])
      expect(p.note).toBe('The day makes money at $752 on the 14-day average.')
    })

    it('calls a loss a loss: every recorded hour is in, so it is not blamed on approvals', () => {
      const p = buildProfitPanel({ ...recorded, speed: { ...base.speed, climbPerDay: -410 }, waiting: { hours: 93, approvedLeftUsd: -2033 } })
      expect(p.note).toBe('The day loses $410 on the 14-day average with every recorded hour counted, 93h of them still waiting on approval. Part can be materials bought ahead of the work — 38% of the window’s job costs is materials.')
      expect(p.noteTone).toBe('amber')
      expect(p.warn).toBe('Counts 93 hours that still wait on approval. On approved hours alone it reads −$2,033 a day.')
    })
  })
})
