import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { accrualLine, accrualPressLabel, burnPerDay, cashLine, runwayDays, runwayFoot, runwayWords, type MoneyCashInput } from './moneyCard'

// Made-up cash and a made-up floor.
const dayLabel = (ymd: string): string => `d${ymd.slice(8)}`
const days = (usd: number[]) => usd.map((cashUsd, i) => ({ ymd: `2026-03-${String(i + 3).padStart(2, '0')}`, offset: i + 1, cashUsd }))
const forecast = (usd: number[], floorUsd = 5_000): NonNullable<MoneyCashInput['forecast']> => {
  const all = days(usd)
  const lowest = all.reduce((a, b) => (b.cashUsd < a.cashUsd ? b : a))
  return { days: all, lowest, floorUsd, clearsFloor: lowest.cashUsd >= floorUsd } as NonNullable<MoneyCashInput['forecast']>
}
const base: MoneyCashInput = { forecast: forecast([20_000, 18_000, 22_000]), cashTodayUsd: 21_000, todayYmd: '2026-03-02', dayLabel }

describe('cashLine', () => {
  it('shows today’s cash as the number, green while the forecast clears the floor', () => {
    expect(cashLine(base)).toEqual({ id: 'cash', label: 'Cash balance', value: '$21.0k', sub: 'Stays over the $5.0k floor. Low point $18.0k on d04.', tone: 'green' })
  })

  it('says the day cash goes under, in amber, when it is not under yet', () => {
    const line = cashLine({ ...base, forecast: forecast([9_000, 4_000, 3_000]) })
    expect(line.value).toBe('$21.0k')
    expect(line.sub).toBe('Goes under the $5.0k floor in 2 days, on d04.')
    expect(line.tone).toBe('amber')
  })

  it('is red only on the number’s tone when cash is under the floor today', () => {
    expect(cashLine({ ...base, cashTodayUsd: 700, forecast: forecast([600, 400, 900]) })).toEqual({ id: 'cash', label: 'Cash balance', value: '$700', sub: 'Under the $5.0k floor.', tone: 'red' })
  })

  it('carries the accounts left out as a note, so a lower figure is never a silent one', () => {
    expect(cashLine({ ...base, cashNote: 'Leaves out 1 account.' }).note).toBe('Leaves out 1 account.')
  })

  it('falls back to the low point when no balance is read, and says so when nothing is', () => {
    expect(cashLine({ ...base, cashTodayUsd: null })).toMatchObject({ label: 'Cash low point, 8 weeks', value: '$18.0k', sub: 'On d04. The floor is $5.0k.', tone: 'green' })
    expect(cashLine({ ...base, cashTodayUsd: null, forecast: forecast([600, 400]) })).toMatchObject({ value: '$400', sub: 'On d04. Under the $5.0k floor.', tone: 'red' })
    expect(cashLine({ ...base, forecast: null })).toEqual({ id: 'cash', label: 'Cash balance', value: 'not read', sub: 'Cash on hand is not read yet.', tone: 'plain' })
  })
})

describe('accrualLine', () => {
  it('is cash, plus what is owed to you, less what you owe', () => {
    expect(accrualLine({ cashUsd: 700, owedToYouUsd: 90_000, owedByYouUsd: 30_000 })).toEqual({ id: 'accrual', label: 'Accrual balance', value: '$60.7k', sub: 'Adds $90.0k owed to you. Takes off $30.0k you owe, subs included.', tone: 'plain' })
  })

  it('turns red when the company owes more than it has and is owed', () => {
    const line = accrualLine({ cashUsd: 700, owedToYouUsd: 10_000, owedByYouUsd: 30_000 })
    expect(line.value).toBe('−$19.3k')
    expect(line.tone).toBe('red')
  })

  it('does not read until cash and both sides of what is owed are read', () => {
    for (const input of [
      { cashUsd: null, owedToYouUsd: 1, owedByYouUsd: 1 },
      { cashUsd: 1, owedToYouUsd: null, owedByYouUsd: 1 },
      { cashUsd: 1, owedToYouUsd: 1, owedByYouUsd: null },
    ]) {
      expect(accrualLine(input)).toEqual({ id: 'accrual', label: 'Accrual balance', value: 'not read', sub: 'What is owed is not read yet.', tone: 'plain' })
    }
  })

  it('says the whole reading on its press', () => {
    expect(accrualPressLabel(accrualLine({ cashUsd: 700, owedToYouUsd: 90_000, owedByYouUsd: 30_000 }))).toBe('Accrual balance $60.7k. Adds $90.0k owed to you. Takes off $30.0k you owe, subs included. Open Money owed.')
    expect(accrualPressLabel(accrualLine({ cashUsd: 700, owedToYouUsd: 90_000, owedByYouUsd: 30_000, burnPerDayUsd: 2_000 }))).toBe('Accrual balance $60.7k. 30 days of runway. Adds $90.0k owed to you. Takes off $30.0k you owe, subs included. Open Money owed.')
  })
})

describe('runway', () => {
  it('burns payroll for a week over seven, plus overhead for a day', () => {
    expect(burnPerDay({ payrollPerWeekUsd: 7_000, overheadPerDayUsd: 500 })).toBe(1_500)
    expect(burnPerDay({ payrollPerWeekUsd: 7_000, overheadPerDayUsd: null })).toBe(1_000)
    expect(burnPerDay({ payrollPerWeekUsd: null, overheadPerDayUsd: null })).toBeNull()
    expect(burnPerDay({ payrollPerWeekUsd: 0, overheadPerDayUsd: 0 })).toBeNull()
  })

  it('counts whole days, and none for a balance at or under zero', () => {
    expect(runwayDays(45_000, 1_500)).toBe(30)
    expect(runwayDays(46_400, 1_500)).toBe(30)
    expect(runwayDays(700, 1_500)).toBe(0)
    expect(runwayDays(-5, 1_500)).toBe(0)
    expect(runwayDays(45_000, null)).toBeNull()
  })

  it('says it in days', () => {
    expect(runwayWords(45_000, 1_500)).toBe('30 days of runway')
    expect(runwayWords(1_600, 1_500)).toBe('1 day of runway')
    expect(runwayWords(700, 1_500)).toBe('Under a day of runway')
    expect(runwayWords(-5, 1_500)).toBe('No runway')
    expect(runwayWords(3_000_000, 1_500)).toBe('2,000 days of runway')
    expect(runwayWords(45_000, null)).toBe('')
  })

  it('rides on each balance when the burn reads, and is left off when it does not', () => {
    expect(cashLine({ ...base, burnPerDayUsd: 1_500 }).runway).toBe('14 days of runway')
    expect(cashLine(base).runway).toBeUndefined()
    // With no balance today the low point stands in, and a low point has no runway.
    expect(cashLine({ ...base, cashTodayUsd: null, burnPerDayUsd: 1_500 }).runway).toBeUndefined()
    expect(accrualLine({ cashUsd: 700, owedToYouUsd: 90_000, owedByYouUsd: 30_000, burnPerDayUsd: 2_000 }).runway).toBe('30 days of runway')
    expect(accrualLine({ cashUsd: 700, owedToYouUsd: 10_000, owedByYouUsd: 30_000, burnPerDayUsd: 2_000 }).runway).toBe('No runway')
    expect(accrualLine({ cashUsd: null, owedToYouUsd: 1, owedByYouUsd: 1, burnPerDayUsd: 2_000 }).runway).toBeUndefined()
  })

  it('says once what it counts', () => {
    expect(runwayFoot(1_500)).toBe('Runway counts payroll and overhead, $1.5k a day.')
    expect(runwayFoot(null)).toBe('')
    expect(plainWordsFailures(runwayFoot(1_500))).toEqual([])
  })
})

describe('the money card’s words', () => {
  it('are plain', () => {
    const lines = [
      cashLine(base),
      cashLine({ ...base, forecast: forecast([9_000, 4_000, 3_000]) }),
      cashLine({ ...base, cashTodayUsd: 700, forecast: forecast([600, 400, 900]) }),
      cashLine({ ...base, cashTodayUsd: null }),
      cashLine({ ...base, forecast: null }),
      accrualLine({ cashUsd: 700, owedToYouUsd: 90_000, owedByYouUsd: 30_000 }),
      accrualLine({ cashUsd: null, owedToYouUsd: null, owedByYouUsd: null }),
    ]
    for (const l of lines) expect(plainWordsFailures(l.sub)).toEqual([])
  })
})
