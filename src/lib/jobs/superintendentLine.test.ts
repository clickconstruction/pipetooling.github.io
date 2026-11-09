import { describe, expect, it } from 'vitest'

import { laborDaysOf, superintendentLine, targetWords, type SuperintendentLineInput } from './superintendentLine'

/** A job half done on half its hours, no money read, no plan, no checklist: the plainest input. */
const base: SuperintendentLineInput = {
  pctDone: 50,
  hoursUsed: 100,
  hoursBudget: 200,
  budgetSource: 'bid',
  money: null,
  plannedFinishYmd: null,
  checklist: { answered: 0, asked: 0 },
  certifiedPct: null,
}

describe('superintendentLine: the verdict', () => {
  it('reads ahead when the work leads the hours, in crew days of 24 h assumed', () => {
    // 60% done on 40% of the hours: 20 points of 200 h = 40 h saved, 1.67 days → 2.
    const l = superintendentLine({ ...base, pctDone: 60, hoursUsed: 80 })
    expect(l.tone).toBe('ahead')
    expect(l.days).toBe(2)
    expect(l.headline).toBe('2 days ahead at this pace.')
    expect(l.hoursPerDay).toBe(24)
    expect(l.hoursPerDayRead).toBe(false)
  })

  it('reads behind when the hours lead the work', () => {
    // 25% done on 62.5% of the hours: 75 h lost, 3.1 days.
    const l = superintendentLine({ ...base, pctDone: 25, hoursUsed: 125 })
    expect(l.tone).toBe('behind')
    expect(l.days).toBe(-3)
    expect(l.headline).toBe('3 days behind.')
  })

  it('reads on pace when the two agree', () => {
    const l = superintendentLine(base)
    expect(l.tone).toBe('even')
    expect(l.headline).toBe('On pace.')
    expect(l.days).toBe(0)
  })

  it('reads a job past its budget by the hours it really used, never as on pace', () => {
    // 80% done on a 47 h budget is 37.6 h earned against 289 h in: 251.4 h behind, about ten crew days of 24 h.
    const l = superintendentLine({ ...base, pctDone: 80, hoursUsed: 289, hoursBudget: 47 })
    expect(l.tone).toBe('behind')
    expect(l.days).toBe(-10)
    expect(l.headline).toBe('10 days behind.')
    expect(Math.round(l.hoursPct)).toBe(615)
  })

  it('says one day in the singular', () => {
    // 55% done on 40%: 30 h saved, 1.25 days → 1.
    expect(superintendentLine({ ...base, pctDone: 55, hoursUsed: 80 }).headline).toBe('1 day ahead at this pace.')
    expect(superintendentLine({ ...base, pctDone: 40, hoursUsed: 110 }).headline).toBe('1 day behind.')
  })

  it('is too early without a percent, under 8 h in, or with no hours budget', () => {
    const none = superintendentLine({ ...base, pctDone: null })
    expect(none.tone).toBe('early')
    expect(none.headline).toBe('No percent set yet.')
    expect(none.move).toEqual({ kind: 'set-pct', why: 'The line needs a percent to read a pace.' })
    const few = superintendentLine({ ...base, hoursUsed: 4 })
    expect(few.tone).toBe('early')
    expect(few.headline).toBe('Too early to call.')
    expect(few.move).toBeNull()
    expect(superintendentLine({ ...base, hoursBudget: 0 }).tone).toBe('early')
    expect(superintendentLine({ ...base, hoursBudget: 0 }).hoursWords).toBe('no hours budget yet')
  })
})

describe('superintendentLine: the money', () => {
  it('outranks the hours when spend leads the work by ten points or more', () => {
    const l = superintendentLine({ ...base, money: { spentUsd: 70, budgetUsd: 100 } })
    expect(l.tone).toBe('behind')
    expect(l.headline).toBe('Spending 20 points ahead of the work.')
    expect(l.money).toMatchObject({ leads: true, wrong: false, spentPct: 70 })
    expect(l.money?.words).toBe('70% of the money spent at 50% done · 20 points ahead of the work')
  })

  it('zeroes the days when the hours read ahead but the money leads', () => {
    const l = superintendentLine({ ...base, pctDone: 60, hoursUsed: 80, money: { spentUsd: 80, budgetUsd: 100 } })
    expect(l.days).toBe(0)
    expect(l.tone).toBe('behind')
  })

  it('leaves the hours verdict alone under ten points', () => {
    const l = superintendentLine({ ...base, money: { spentUsd: 58, budgetUsd: 100 } })
    expect(l.tone).toBe('even')
    expect(l.money?.leads).toBe(false)
    expect(l.money?.words).toBe('58% of the money spent at 50% done')
  })

  it('says the money budget looks wrong past three times over, instead of a verdict', () => {
    const l = superintendentLine({ ...base, money: { spentUsd: 400, budgetUsd: 100 } })
    expect(l.tone).toBe('behind')
    expect(l.headline).toBe('The money budget looks wrong.')
    expect(l.money).toMatchObject({ wrong: true, leads: true })
    expect(l.money?.words).toBe('Spent is 4× the money budget; the budget looks wrong, not the crew.')
  })

  it('reads no money line without a money budget', () => {
    expect(superintendentLine({ ...base, money: { spentUsd: 10, budgetUsd: 0 } }).money).toBeNull()
  })
})

describe('superintendentLine: the crew day', () => {
  it('reads the mean of the worked days when there are two or more', () => {
    const l = superintendentLine({ ...base, laborDays: [{ ymd: '2026-10-20', hours: 8 }, { ymd: '2026-10-21', hours: 16 }, { ymd: '2026-10-22', hours: 24 }] })
    expect(l.hoursPerDay).toBe(16)
    expect(l.hoursPerDayRead).toBe(true)
    // 100 h in at 16 h a day: 6.25 days used, 100 h left is 6.25 days.
    expect(l.daysUsed).toBeCloseTo(6.25)
    expect(l.daysLeft).toBeCloseTo(6.25)
  })

  it('assumes the given crew day, else 24, with fewer than two worked days', () => {
    expect(superintendentLine({ ...base, laborDays: [{ ymd: '2026-10-20', hours: 8 }] }).hoursPerDay).toBe(24)
    expect(superintendentLine({ ...base, laborDays: [{ ymd: '2026-10-20', hours: 8 }], crewHoursPerDay: 30 }).hoursPerDay).toBe(30)
    // A day with no hours is not a worked day.
    expect(superintendentLine({ ...base, laborDays: [{ ymd: '2026-10-20', hours: 8 }, { ymd: '2026-10-21', hours: 0 }] }).hoursPerDayRead).toBe(false)
  })

  it('reads the days ahead in the job\'s own crew day', () => {
    // 40 h saved at 8 h a day is 5 days, where 24 h a day read 2.
    const l = superintendentLine({ ...base, pctDone: 60, hoursUsed: 80, laborDays: [{ ymd: '2026-10-20', hours: 8 }, { ymd: '2026-10-21', hours: 8 }] })
    expect(l.days).toBe(5)
  })
})

describe('superintendentLine: the words', () => {
  it('names the planned finish and the finish at pace', () => {
    const l = superintendentLine({ ...base, pctDone: 60, hoursUsed: 80, plannedFinishYmd: '2026-11-20' })
    expect(l.finishWords).toBe('Planned finish Nov 20. At this pace, Nov 18.')
    expect(superintendentLine({ ...base, pctDone: null, plannedFinishYmd: '2026-11-20' }).finishWords).toBe('Planned finish Nov 20.')
    expect(superintendentLine(base).finishWords).toBe('No planned finish on the job yet.')
  })

  it("stacks the proof: the office's sign-off, then the checklist, then the crew's own percent as provisional until signed (the owner's first call)", () => {
    expect(superintendentLine({ ...base, certifiedPct: 40, certifiedOn: '2026-11-08', checklist: { answered: 3, asked: 5 } }).proofWords).toBe(
      "Signed off by the office at 40% on Nov 8 · checklist 3 of 5 ready · the crew's 50% reads provisional until the office signs it off.",
    )
    // The office signed the very figure the crew reads: nothing is provisional (the second walk's slip 3 called it so).
    expect(superintendentLine({ ...base, pctDone: 25, certifiedPct: 25 }).proofWords).toBe("Signed off by the office at 25% · no checklist on the stages yet · the crew's 25% is the signed-off figure.")
    expect(superintendentLine({ ...base, pctDone: null }).proofWords).toBe('No office sign-off on the percent yet · no checklist on the stages yet · set the percent to read a pace.')
    expect(superintendentLine(base).proofWords).toContain("No office sign-off on the percent yet · no checklist on the stages yet · the crew's 50% reads provisional until the office signs it off.")
    // No pay app anywhere in the words: the sign-off is the office's own press.
    expect(superintendentLine({ ...base, certifiedPct: 40 }).proofWords).not.toMatch(/pay app/)
  })

  it("counts a sub's sheet hours into the hours in, as the Scoreboard does (the owner's third call; the second walk's slip 4)", () => {
    // 0 team hours, 9 h on a sub sheet against 70 h: the card read "0 h in · hours 0%" while the score counted the 9 h.
    const subOnly = superintendentLine({ ...base, hoursBudget: 70, hoursUsed: 0, subHours: 9, pctDone: 25 })
    expect(subOnly.hoursWords).toBe('70 h budget ◆ from the bid · 9 h in, all on sub sheets')
    expect(subOnly.hoursPct).toBeCloseTo((9 / 70) * 100, 6)
    // 9 h in is past the 8 h floor, so the line reads a pace: 25% done against 13% of the hours is under a crew day ahead.
    expect(subOnly.tone).toBe('even')
    expect(superintendentLine({ ...base, hoursBudget: 70, hoursUsed: 0, subHours: 7, pctDone: 25 }).tone).toBe('early')
    const mixed = superintendentLine({ ...base, hoursUsed: 100, subHours: 9 })
    expect(mixed.hoursWords).toBe('200 h budget ◆ from the bid · 109 h in (9 h on sub sheets)')
    expect(mixed.hoursPct).toBeCloseTo(54.5, 6)
    // Sub hours alone, with the team's not yet read, still count.
    expect(superintendentLine({ ...base, hoursUsed: null, subHours: 9 }).hoursWords).toBe('200 h budget ◆ from the bid · 9 h in, all on sub sheets')
    expect(superintendentLine({ ...base, subHours: null }).hoursWords).toBe('200 h budget ◆ from the bid · 100 h in')
  })

  it('names the one move when behind: the open checklist, else the percent', () => {
    const open = superintendentLine({ ...base, pctDone: 25, hoursUsed: 125, checklist: { answered: 3, asked: 5 } })
    expect(open.move).toEqual({ kind: 'open-checklist', why: '125 h in at 25% done; 2 checks still open.' })
    const pct = superintendentLine({ ...base, pctDone: 25, hoursUsed: 125 })
    expect(pct.move).toEqual({ kind: 'set-pct', why: '125 h in and the percent reads 25%. If the work moved, set it.' })
    expect(superintendentLine(base).move).toBeNull()
  })

  it('wears the budget source as a glyph in the hours words', () => {
    expect(superintendentLine(base).hoursWords).toBe('200 h budget ◆ from the bid · 100 h in')
    expect(superintendentLine({ ...base, budgetSource: 'typed' }).hoursWords).toContain('✎ typed by the office')
    expect(superintendentLine({ ...base, budgetSource: 'assumed' }).hoursWords).toContain('≈ assumed')
    expect(superintendentLine({ ...base, hoursUsed: null, pctDone: 10 }).hoursWords).toBe('200 h budget ◆ from the bid · — h in')
  })

  it("says frozen at award when the budget is the award's hours, the number the score reads (the owner's call of 2026-11-09)", () => {
    expect(superintendentLine({ ...base, budgetFrozen: true }).hoursWords).toBe('200 h budget ◆ from the bid, frozen at award · 100 h in')
    expect(superintendentLine({ ...base, budgetFrozen: true, budgetSource: 'typed' }).hoursWords).toBe('200 h budget ✎ typed by the office, frozen at award · 100 h in')
    // A target the leader set is not the award, whatever the read says.
    expect(superintendentLine({ ...base, budgetFrozen: true, budgetSource: 'target' }).hoursWords).toBe('200 h budget 🎯 expected · 100 h in')
  })

  it('reads the target line only when the budget is the target', () => {
    const target = { by: 'Robert', at: '2026-11-01T20:00:00Z', from: 138, why: 'the bid carried 138 h for a slab job that framed in a week' }
    const l = superintendentLine({ ...base, hoursBudget: 110, budgetSource: 'target', target })
    expect(l.targetLine).toBe('Expected 110 h, set by Robert on Nov 1 (was 138 h): the bid carried 138 h for a slab job that framed in a week')
    expect(superintendentLine({ ...base, target }).targetLine).toBeNull()
    expect(superintendentLine({ ...base, budgetSource: 'target', target: null }).targetLine).toBeNull()
  })
})

describe('targetWords', () => {
  it('reads the day in the company calendar and skips a missing from', () => {
    // 04:30Z on Nov 2 is still Nov 1 in Chicago.
    expect(targetWords({ by: 'Robert', at: '2026-11-02T04:30:00Z', from: null, why: 'why' }, 110.4)).toBe('Expected 110 h, set by Robert on Nov 1: why')
    expect(targetWords({ by: '', at: '2026-11-01T20:00:00Z', from: 138, why: 'why' }, 110)).toBe('Expected 110 h, set by the office on Nov 1 (was 138 h): why')
  })
})

describe('laborDaysOf', () => {
  it('sums the team labor hours by work date, in date order, and skips everything else', () => {
    const days = laborDaysOf([
      { source: 'team_labor', dateKey: '2026-10-21', hours: 8 },
      { source: 'team_labor', dateKey: '2026-10-20', hours: 9 },
      { source: 'team_labor', dateKey: '2026-10-21', hours: 7.5 },
      { source: 'sub_labor', dateKey: '2026-10-21', hours: 40 },
      { source: 'team_labor', dateKey: null, hours: 8 },
      { source: 'team_labor', dateKey: '2026-10-22' },
      { source: 'team_labor', dateKey: '2026-10-23', hours: 0 },
    ])
    expect(days).toEqual([
      { ymd: '2026-10-20', hours: 9 },
      { ymd: '2026-10-21', hours: 15.5 },
    ])
  })
})
