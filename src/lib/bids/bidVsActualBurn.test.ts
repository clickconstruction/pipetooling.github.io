import { describe, expect, it } from 'vitest'
import { bidVsActualDirectWords, bidVsActualJobVerdict, isFinishedJobStatus } from './bidVsActualBurn'
import { buildBurnForVerdict, readTargetMarginPct } from '../jobs/jobBurnForVerdict'
import { resolveJobBudget, spendByComponent, type JobBudgetRowLike } from '../jobs/jobBudget'
import { buildCostsVerdict } from '../jobs/jobCostsVerdict'
import { newestPercentEvent } from '../jobChargesTimeline'
import type { JobChargesTimelineInputs } from '../../hooks/useJobChargesTimelineInputs'

// A linked job five field days in: $9,000 of team labor, $6,000 of parts, a $1,500 sub sheet, 50% reported.
const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`
const inputs: JobChargesTimelineInputs = {
  chargeEvents: [
    ...[1, 2, 3, 4, 5].map((d) => ({ source: 'team_labor' as const, dateKey: day(d), amount: 1_800, label: 'crew' })),
    { source: 'supply_house' as const, dateKey: day(2), amount: 6_000, label: 'Ferguson' },
    { source: 'sub_labor' as const, dateKey: day(4), amount: 1_500, label: 'sub' },
  ],
  valueEvents: [{ dateKey: day(5), percent: 50, label: 'report', kind: 'report' }],
  paymentEvents: [],
  revenue: 41_550,
  fallbackPercent: 40,
  teamHours: 240,
  cardChargesExcluded: false,
}
const budgetRow: JobBudgetRowLike = { kind: 'bid', bid_id: 'b76', labor_hours: 300, labor_rate: 35, labor_usd: 10_500, materials_usd: 9_000, subs_usd: 2_000, other_usd: 500, total_direct_usd: 22_000, completeness: { usable: true } }
const today = '2026-09-12'

/** The Costs tab's own sequence (`JobCostsTabCharts`), overhead left out — what the lens must equal. */
function costsTabVerdict(i: JobChargesTimelineInputs, row: JobBudgetRowLike | null, finished: boolean, bidNumber: string | null) {
  const resolved = resolveJobBudget({ row, priceUsd: i.revenue, targetMarginPct: readTargetMarginPct() })
  const burnInputs = i.fallbackPercent == null && finished ? { ...i, fallbackPercent: 100 } : i
  const burn = buildBurnForVerdict(burnInputs, null, resolved)
  const newest = newestPercentEvent(i.valueEvents)
  return buildCostsVerdict({ burn, priceUsd: i.revenue, spend: spendByComponent(i.chargeEvents), teamHours: i.teamHours, teamPeople: null, resolved, bidLabel: bidNumber, latestReportYmd: newest && newest.kind !== 'manual' ? newest.dateKey : null, jobPct: i.fallbackPercent, jobFinished: finished, todayYmd: today })
}

describe('bidVsActualJobVerdict (v2.5046)', () => {
  it('is the Costs tab’s verdict for the same job, to the cent', () => {
    const v = bidVsActualJobVerdict({ inputs, budgetRow, status: 'working', bidNumber: '76', todayYmd: today })
    expect(v).toEqual(costsTabVerdict(inputs, budgetRow, false, '76'))
    // spent $16,500 at 50% done → $33,000 at completion → $8,550 · 20.6% direct
    expect(v.directMargin!.usd).toBeCloseTo(8_550, 6)
    expect(v.directMargin!.pct).toBeCloseTo(20.58, 2)
    expect(v.sections.find((s) => s.key === 'materials')).toMatchObject({ spentUsd: 6_000, budgetUsd: 9_000 })
  })
  it('a billed job with no % anywhere reads done, as on the Costs tab; with no budget row it stands on the assumption', () => {
    const noPct = { ...inputs, valueEvents: [], fallbackPercent: null }
    const v = bidVsActualJobVerdict({ inputs: noPct, budgetRow: null, status: 'billed', bidNumber: null, todayYmd: today })
    expect(v).toEqual(costsTabVerdict(noPct, null, true, null))
    expect(v.pctDone).toBe(100)
    expect(v.directMargin!.usd).toBeCloseTo(41_550 - 16_500, 6)
    expect(v.budgetSource).toBe('assumed')
  })
  it('only billed and paid are finished', () => {
    expect(['billed', 'paid'].map(isFinishedJobStatus)).toEqual([true, true])
    expect(['working', 'waiting', 'ready_to_bill', null].map(isFinishedJobStatus)).toEqual([false, false, false, false])
  })
})

describe('bidVsActualDirectWords (v2.5046)', () => {
  const v = bidVsActualJobVerdict({ inputs, budgetRow, status: 'working', bidNumber: '76', todayYmd: today })
  it('the margin at completion, and the dollars under it', () => {
    expect(bidVsActualDirectWords(v)).toEqual({ big: '21%', sub: '$8,550 at completion' })
    expect(bidVsActualDirectWords({ ...v, directMargin: { usd: -2_400.4, pct: -5.8 } })).toEqual({ big: '-6%', sub: '−$2,400 at completion' })
  })
  it('says why there is no figure yet', () => {
    expect(bidVsActualDirectWords({ ...v, priceUsd: null })).toEqual({ big: '—', sub: 'no price on the job' })
    expect(bidVsActualDirectWords({ ...v, directMargin: null, pctDone: null })).toEqual({ big: '—', sub: 'needs a % complete' })
    expect(bidVsActualDirectWords({ ...v, directMargin: null, pctDone: 8, timeLeft: { ...v.timeLeft, fieldDays: 2 } })).toEqual({ big: 'too early', sub: '2 field days · 8% done' })
  })
})
