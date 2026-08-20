import { describe, expect, it } from 'vitest'
import {
  buildPaidProfitChart,
  niceCeil,
  paidProfitMoneyLabel,
  paidProfitRadius,
  paidProfitX,
  paidProfitXDomainMax,
  paidProfitY,
  paidProfitYDomain,
  paidProfitYTicks,
} from './paidProfitChart'
import type { JobWithDetails } from '../../types/jobWithDetails'

function job(id: string, revenue: number, over: Partial<JobWithDetails> = {}): JobWithDetails {
  return {
    id,
    hcp_number: '957',
    click_number: null,
    job_name: 'Creekside repipe',
    customer_name: 'H & I Construction',
    revenue,
    ...over,
  } as unknown as JobWithDetails
}

describe('buildPaidProfitChart', () => {
  it('plots jobs with stats rows; profit = revenue − cost; per-hour when clocked', () => {
    const { points, stats } = buildPaidProfitChart(
      [job('a', 26000), job('b', 5200)],
      { a: { cost: 23900, hours: 140 }, b: { cost: 7600, hours: 45 } },
    )
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ jobId: 'a', profit: 2100, hours: 140 })
    expect(points[0]!.perHour).toBeCloseTo(15, 0)
    expect(points[1]!.profit).toBe(-2400)
    expect(stats.profitTotal).toBe(-300)
    expect(stats.loserCount).toBe(1)
    expect(stats.loserTotal).toBe(-2400)
    expect(stats.hoursTotal).toBe(185)
  })

  it('never fakes profit for jobs missing stats — skips and counts them', () => {
    const { points, stats } = buildPaidProfitChart([job('a', 9000)], {})
    expect(points).toHaveLength(0)
    expect(stats.skippedNoStats).toBe(1)
    expect(buildPaidProfitChart([job('a', 9000)], null).stats.skippedNoStats).toBe(1)
  })

  it('sub-only jobs (≈0 clocked hours) plot at the left edge with per-hour null', () => {
    const { points, stats } = buildPaidProfitChart([job('a', 4000)], { a: { cost: 2500, hours: 0 } })
    expect(points[0]!.hours).toBe(0)
    expect(points[0]!.perHour).toBeNull()
    expect(stats.medianPerHour).toBeNull()
  })
})

describe('scales', () => {
  it('niceCeil snaps to 1/2/5×10ⁿ', () => {
    expect(niceCeil(7)).toBe(10)
    expect(niceCeil(130)).toBe(200)
    expect(niceCeil(4200)).toBe(5000)
    expect(niceCeil(50000)).toBe(50000)
  })

  it('x domain floors at 40h and rounds nice; y always spans $0', () => {
    expect(paidProfitXDomainMax([])).toBe(40)
    expect(paidProfitXDomainMax([{ hours: 340 } as never])).toBe(500)
    expect(paidProfitYDomain([{ profit: 42000 } as never])).toEqual({ min: 0, max: 50000 })
    expect(paidProfitYDomain([{ profit: 42000 } as never, { profit: -3800 } as never])).toEqual({
      min: -5000,
      max: 50000,
    })
  })

  it('maps linearly with the zero line inside the plot', () => {
    const dom = { min: -10000, max: 50000 }
    expect(paidProfitY(dom.max, dom, 20, 440)).toBe(20)
    expect(paidProfitY(dom.min, dom, 20, 440)).toBe(440)
    expect(paidProfitY(0, dom, 20, 440)).toBe(370)
    expect(paidProfitX(0, 400, 70, 820)).toBe(70)
    expect(paidProfitX(400, 400, 70, 820)).toBe(820)
  })

  it('y ticks are nice steps including 0', () => {
    const ticks = paidProfitYTicks({ min: -10000, max: 50000 })
    expect(ticks).toContain(0)
    expect(ticks[0]).toBeGreaterThanOrEqual(-10000)
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(50000)
  })

  it('radius and signed money labels', () => {
    expect(paidProfitRadius(0)).toBe(3)
    expect(paidProfitRadius(80000)).toBeCloseTo(28.3, 1)
    expect(paidProfitMoneyLabel(-6800)).toBe('−$6.8k')
    expect(paidProfitMoneyLabel(318000)).toBe('$318k')
    expect(paidProfitMoneyLabel(850)).toBe('$850')
  })
})
