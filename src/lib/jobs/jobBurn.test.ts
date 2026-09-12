import { describe, expect, it } from 'vitest'
import type { JobChargeEvent, JobValueEvent } from '../jobChargesTimeline'
import { addWeekdays, buildJobBurn, isWeekdayYmd, lastWeekdays, resolveJobBurnBudget } from './jobBurn'

const TODAY = '2026-09-09' // a Wednesday

const team = (ymd: string, amount: number): JobChargeEvent => ({ source: 'team_labor', dateKey: ymd, amount, label: 'x' })
const parts = (ymd: string, amount: number): JobChargeEvent => ({ source: 'supply_house', dateKey: ymd, amount, label: 'x' })
const sub = (ymd: string, amount: number): JobChargeEvent => ({ source: 'sub_labor', dateKey: ymd, amount, label: 'x' })
const report = (ymd: string, percent: number | null): JobValueEvent => ({ dateKey: ymd, percent, label: 'r' })

/** Five field days Sep 1–5 (Tue–Sat: Sat is still a field day if worked), $1,000 team + $200 parts each. */
const week = [
  team('2026-09-01', 1000), parts('2026-09-01', 200),
  team('2026-09-02', 1000), parts('2026-09-02', 200),
  team('2026-09-03', 1000), parts('2026-09-03', 200),
  team('2026-09-04', 1000), parts('2026-09-04', 200),
  team('2026-09-08', 1000), parts('2026-09-08', 200),
]
const budget = resolveJobBurnBudget({ priceUsd: 20000, bidEstimateUsd: null, targetMarginPct: 40 })! // $12,000

describe('resolveJobBurnBudget', () => {
  it('prefers a bid estimate, else price × (1 − target), else null', () => {
    expect(resolveJobBurnBudget({ priceUsd: 20000, bidEstimateUsd: 13500, targetMarginPct: 40 })).toEqual({ usd: 13500, source: 'bid_estimate', targetMarginPct: null })
    expect(budget).toEqual({ usd: 12000, source: 'target_margin', targetMarginPct: 40 })
    expect(resolveJobBurnBudget({ priceUsd: 20000, bidEstimateUsd: null, targetMarginPct: 0 })).toEqual({ usd: 13000, source: 'target_margin', targetMarginPct: 35 })
    expect(resolveJobBurnBudget({ priceUsd: null, bidEstimateUsd: null, targetMarginPct: 40 })).toBeNull()
    expect(resolveJobBurnBudget({ priceUsd: 0, bidEstimateUsd: null, targetMarginPct: 40 })).toBeNull()
  })
})

describe('weekday helpers', () => {
  it('knows weekends and walks weekdays', () => {
    expect(isWeekdayYmd('2026-09-05')).toBe(false) // Sat
    expect(isWeekdayYmd('2026-09-07')).toBe(true) // Mon
    expect(lastWeekdays('2026-09-09', 3)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09'])
    expect(lastWeekdays('2026-09-06', 2)).toEqual(['2026-09-03', '2026-09-04']) // Sunday end excluded
    expect(addWeekdays('2026-09-09', 3)).toBe('2026-09-14') // Thu, Fri, Mon
    expect(addWeekdays('2026-09-09', 2.2)).toBe('2026-09-14') // rounds up
  })
})

describe('buildJobBurn — the one number', () => {
  it('spent ÷ % done = cost at completion; price − that = margin; spend leading progress by > 5 pts is hot', () => {
    const m = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 40)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.spentUsd).toBe(6000)
    expect(m.percentDone).toBe(40)
    expect(m.percentSource).toBe('report')
    expect(m.spentPctOfBudget).toBeCloseTo(50, 5) // 6,000 of 12,000
    expect(m.leadPts).toBeCloseTo(10, 5)
    expect(m.status).toBe('hot')
    expect(m.eacUsd).toBeCloseTo(15000, 5)
    expect(m.marginUsd).toBeCloseTo(5000, 5)
    expect(m.marginPct).toBeCloseTo(25, 5)
    expect(m.fieldDays).toBe(5)
  })

  it('reads ok when progress keeps up, and early with fewer than 3 field days or under 10 %', () => {
    const ok = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 55)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(ok.status).toBe('ok')
    expect(ok.leadPts).toBeCloseTo(-5, 5)
    const early = buildJobBurn({ chargeEvents: week.slice(0, 4), valueEvents: [report('2026-09-02', 30)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(early.status).toBe('early')
    expect(early.eacUsd).toBeNull()
    const low = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 8)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(low.status).toBe('early')
  })

  it('falls back to the job % when no dated report carries one, and says no_budget without a price', () => {
    const m = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', null)], fallbackPercent: 50, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.percentDone).toBe(50)
    expect(m.percentSource).toBe('job')
    const nb = buildJobBurn({ chargeEvents: week, valueEvents: [], fallbackPercent: 50, priceUsd: null, budget: null, overhead: null, todayYmd: TODAY })
    expect(nb.status).toBe('no_budget')
    expect(nb.spentPctOfBudget).toBeNull()
  })
})

describe('buildJobBurn — burn rate, runway, and overhead in the projection only', () => {
  it('burn = spend over the last ten field days ÷ those days; budget-gone date walks weekdays; work left from progress per field day', () => {
    const m = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 40)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.burnPerFieldDayUsd).toBeCloseTo(1200, 5)
    expect(m.budgetRemainingUsd).toBe(6000)
    expect(m.budgetGoneInFieldDays).toBeCloseTo(5, 5)
    expect(m.budgetGoneYmd).toBe('2026-09-16') // 5 weekdays after Wed Sep 9
    expect(m.progressPerFieldDay).toBeCloseTo(8, 5)
    expect(m.workLeftFieldDays).toBeCloseTo(7.5, 5)
  })

  it('a finished job (100 %) has no runway and no forecast, only the verdict', () => {
    const m = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 100)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.workLeftFieldDays).toBe(0)
    expect(m.budgetGoneYmd).toBeNull()
    expect(m.cumulative.every((r) => r.ymd <= TODAY)).toBe(true)
    expect(m.eacUsd).toBe(6000)
  })

  it('goes idle after 30 days without a field day — no burn, no runway', () => {
    const old = [team('2026-06-01', 1000), team('2026-06-02', 1000), team('2026-06-03', 1000)]
    const m = buildJobBurn({ chargeEvents: old, valueEvents: [report('2026-06-03', 30)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.burnPerFieldDayUsd).toBeNull()
    expect(m.budgetGoneYmd).toBeNull()
  })

  it('overhead never touches spent / burn / lead, only the true margin: day-share × days left', () => {
    const withOh = buildJobBurn({
      chargeEvents: week,
      valueEvents: [report('2026-09-08', 40)],
      fallbackPercent: null,
      priceUsd: 20000,
      budget,
      overhead: { shareToDateUsd: 1500, perFieldDayUsd: 300 },
      todayYmd: TODAY,
    })
    const without = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-08', 40)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(withOh.spentUsd).toBe(without.spentUsd)
    expect(withOh.leadPts).toBe(without.leadPts)
    expect(withOh.eacUsd).toBe(without.eacUsd)
    expect(withOh.overhead).toMatchObject({ shareToDateUsd: 1500, perFieldDayUsd: 300 })
    expect(withOh.overhead!.projectedRemainingUsd).toBeCloseTo(2250, 5) // 300 × 7.5
    expect(withOh.overhead!.trueMarginUsd).toBeCloseTo(5000 - 1500 - 2250, 5)
    expect(withOh.overhead!.trueMarginPct).toBeCloseTo(6.25, 3)
  })
})

describe('buildJobBurn — the series', () => {
  it('daily = the last 14 weekdays, zero-filled, split team / sub / parts, with a trailing 7-weekday mean', () => {
    const m = buildJobBurn({ chargeEvents: [...week, sub('2026-09-08', 500)], valueEvents: [], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.daily).toHaveLength(14)
    expect(m.daily[0]!.ymd).toBe('2026-08-21')
    expect(m.daily[13]!.ymd).toBe('2026-09-09')
    const sep8 = m.daily.find((d) => d.ymd === '2026-09-08')!
    expect(sep8).toMatchObject({ team: 1000, sub: 500, parts: 200, total: 1700 })
    // Sep 8's window = Aug 28 … Sep 8 weekdays: Sep 1–4 (1,200 each) + Sep 8 (1,700) + two zero days
    expect(sep8.avg7).toBeCloseTo((4 * 1200 + 1700) / 7, 2)
    expect(m.daily.find((d) => d.ymd === '2026-09-09')!.total).toBe(0)
  })

  it('cumulative runs from the first dated charge to today, steps earned value at reports, then forecasts to the budget', () => {
    const m = buildJobBurn({ chargeEvents: week, valueEvents: [report('2026-09-03', 20), report('2026-09-08', 40)], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    const first = m.cumulative[0]!
    expect(first.ymd).toBe('2026-09-01')
    expect(first.actual).toBe(1200)
    expect(first.earned).toBeNull() // no report yet
    const sep3 = m.cumulative.find((r) => r.ymd === '2026-09-03')!
    expect(sep3.earned).toBe(2400) // 20% × 12,000
    const today = m.cumulative.find((r) => r.ymd === TODAY)!
    expect(today.actual).toBe(6000)
    expect(today.earned).toBe(4800)
    expect(today.forecast).toBe(6000)
    const fc = m.cumulative.filter((r) => r.ymd > TODAY)
    expect(fc.length).toBeGreaterThan(0)
    expect(fc.every((r) => r.actual === null && r.forecast != null)).toBe(true)
    expect(fc[fc.length - 1]!.forecast).toBe(12000) // capped at the budget
    expect(fc.every((r) => isWeekdayYmd(r.ymd))).toBe(true)
  })

  it('keeps undated charges in spent (and the cumulative baseline) without a day', () => {
    const m = buildJobBurn({ chargeEvents: [...week, { source: 'tally_part', dateKey: null, amount: 400, label: 'x' }], valueEvents: [], fallbackPercent: null, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.spentUsd).toBe(6400)
    expect(m.undatedUsd).toBe(400)
    expect(m.cumulative[0]!.actual).toBe(1600)
  })
  it('earnedBasis: price steps the earned line at % done × price, not the budget (v2.3361)', () => {
    const charges: JobChargeEvent[] = [{ dateKey: '2026-09-01', amount: 100, source: 'team_labor', label: 'a' } as JobChargeEvent]
    const reports: JobValueEvent[] = [{ dateKey: '2026-09-01', percent: 50, label: 'r' }]
    const budget = { usd: 500, source: 'target_margin' as const, targetMarginPct: 50 }
    const onBudget = buildJobBurn({ chargeEvents: charges, valueEvents: reports, fallbackPercent: null, priceUsd: 1000, budget, overhead: null, todayYmd: '2026-09-01' })
    const onPrice = buildJobBurn({ chargeEvents: charges, valueEvents: reports, fallbackPercent: null, priceUsd: 1000, budget, overhead: null, todayYmd: '2026-09-01', earnedBasis: 'price' })
    expect(onBudget.cumulative[0]!.earned).toBe(250)
    expect(onPrice.cumulative[0]!.earned).toBe(500)
  })
})

describe('buildJobBurn — the newest % wins (v2.3372)', () => {
  it('a hand-set after the last report is the % done and reads as the job’s own', () => {
    const manual: JobValueEvent = { dateKey: '2026-09-03', percent: 90, label: 'Set on the job by Taunya', kind: 'manual' }
    const m = buildJobBurn({ chargeEvents: [team('2026-09-01', 12000)], valueEvents: [report('2026-05-15', 77), manual], fallbackPercent: 90, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(m.percentDone).toBe(90)
    expect(m.percentSource).toBe('job')
    const later = buildJobBurn({ chargeEvents: [team('2026-09-01', 12000)], valueEvents: [manual, report('2026-09-05', 95)], fallbackPercent: 90, priceUsd: 20000, budget, overhead: null, todayYmd: TODAY })
    expect(later.percentDone).toBe(95)
    expect(later.percentSource).toBe('report')
  })
})
