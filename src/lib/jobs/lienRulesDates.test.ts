import { describe, expect, it } from 'vitest'
import { lienRuleDateRows, lienRuleMonthWords, lienRulesJobFrom, lienRulesJobLine } from './lienRulesDates'

describe('lienRuleDateRows (v2.4826)', () => {
  it('with no job, centres on the month whose commercial notice falls this month', () => {
    const rows = lienRuleDateRows('2026-10-07')
    expect(rows.map((r) => r.month)).toEqual(['2026-06', '2026-07', '2026-08'])
    expect(rows.map((r) => r.monthWords)).toEqual(['June', 'July', 'August'])
    expect(rows.every((r) => !r.lit)).toBe(true)
  })
  it('prints the statutory 15ths, weekend-rolled, for both kinds', () => {
    const [june, july, august] = lienRuleDateRows('2026-10-07')
    // Aug 15 2026 is a Saturday, Nov 15 2026 a Sunday.
    expect(june).toMatchObject({ noticeCommercial: 'Sep 15', noticeHouse: 'Aug 17', lienCommercial: 'Oct 15', lienHouse: 'Sep 15' })
    expect(july).toMatchObject({ noticeCommercial: 'Oct 15', noticeHouse: 'Sep 15', lienCommercial: 'Nov 16', lienHouse: 'Oct 15' })
    expect(august).toMatchObject({ noticeCommercial: 'Nov 16', noticeHouse: 'Oct 15', lienCommercial: 'Dec 15', lienHouse: 'Nov 16' })
  })
  it('with a job, centres on its work month and lights that row', () => {
    const rows = lienRuleDateRows('2026-10-07', { workMonth: '2026-04' })
    expect(rows.map((r) => r.month)).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(rows.map((r) => r.lit)).toEqual([false, true, false])
  })
  it('names the year only when it is not this year', () => {
    expect(lienRuleMonthWords('2025-12', '2026-01-04')).toBe('December 2025')
    expect(lienRuleDateRows('2026-01-04').map((r) => r.monthWords)).toEqual(['September 2025', 'October 2025', 'November 2025'])
  })
})

describe('lienRulesJobFrom + lienRulesJobLine', () => {
  const months = [{ key: '2026-06' }, { key: '2026-07' }]
  it('a sub job on a commercial property: the queue deadline and the § 53.052 date from the last month', () => {
    const job = lienRulesJobFrom({ label: '804 · Summit GC- Auto Zone', propertyKind: 'non_residential', isSub: true, months, earliestDeadline: '2026-10-15' }, '2026-10-07')
    expect(job).toMatchObject({ kindWords: 'commercial', workMonth: '2026-07', workMonthWords: 'July', noticeDue: '2026-10-15', lienDue: '2026-11-16' })
    expect(lienRulesJobLine(job)).toEqual({ facts: 'Sub job · commercial · last work July', noticeDue: 'Oct 15', lienDue: 'Nov 16' })
  })
  it('a house moves the lien date a month earlier, and an unset kind says so', () => {
    expect(lienRulesJobFrom({ label: 'J1', propertyKind: 'residential', isSub: true, months, earliestDeadline: null }, '2026-10-07')).toMatchObject({ noticeDue: '2026-09-15', lienDue: '2026-10-15' })
    expect(lienRulesJobFrom({ label: 'J1', propertyKind: '', isSub: true, months, earliestDeadline: null }, '2026-10-07').kindWords).toBe('kind unknown')
  })
  it('a direct job owes no notice: the strip says so and leaves the notice date out', () => {
    const job = lienRulesJobFrom({ label: 'J2', propertyKind: 'non_residential', isSub: false, months, earliestDeadline: '2026-10-15' }, '2026-10-07')
    expect(job.noticeDue).toBe('')
    expect(lienRulesJobLine(job)).toEqual({ facts: 'Direct job, no monthly notice · commercial · last work July', noticeDue: '', lienDue: 'Nov 16' })
  })
  it('a job with no months has no dates and no work month', () => {
    const job = lienRulesJobFrom({ label: 'J3', propertyKind: 'non_residential', isSub: true, months: [], earliestDeadline: null }, '2026-10-07')
    expect(job).toMatchObject({ workMonth: '', workMonthWords: '', noticeDue: '', lienDue: '' })
    expect(lienRuleDateRows('2026-10-07', job).map((r) => r.lit)).toEqual([false, false, false])
  })
})
