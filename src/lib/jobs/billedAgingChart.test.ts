import { describe, expect, it } from 'vitest'
import {
  BILLED_AGING_Y_FLOOR,
  billedAgingMoneyLabel,
  billedAgingRadius,
  billedAgingX,
  billedAgingXDomainMax,
  billedAgingY,
  billedAgingYDomainMax,
  billedAgingYTicks,
  buildBilledAgingChart,
} from './billedAgingChart'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const NOW = new Date('2026-08-19T12:00:00Z')

function job(over: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'j1',
    hcp_number: '964',
    click_number: null,
    job_name: 'Pondhill demo',
    customer_name: 'H & I Construction',
    revenue: 3013,
    payments_made: 0,
    payments: [],
    invoices: [],
    ...over,
  } as unknown as JobWithDetails
}

function invRow(over: {
  id?: string
  amount?: number
  estimated_bill_date?: string | null
  job?: JobWithDetails
}): StageRow {
  const j = over.job ?? job({})
  return {
    kind: 'invoice',
    job: j,
    inv: {
      id: over.id ?? 'inv1',
      job_id: j.id,
      amount: over.amount ?? 3013,
      status: 'billed',
      sequence_order: 1,
      estimated_bill_date: over.estimated_bill_date === undefined ? '2026-08-08' : over.estimated_bill_date,
      billed_at: null,
    },
  } as unknown as StageRow
}

describe('buildBilledAgingChart', () => {
  it('plots dated open rows with the chip clock and open amount; skips undated ones visibly', () => {
    const dated = invRow({ id: 'a', amount: 3013, estimated_bill_date: '2026-08-08' })
    const undated = invRow({ id: 'b', amount: 500, estimated_bill_date: null })
    const { points, stats } = buildBilledAgingChart([dated, undated], { j1: 2140 }, NOW)
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({
      invoiceId: 'a',
      jobId: 'j1',
      label: '964 · Pondhill demo',
      days: 11,
      open: 3013,
      cost: 2140,
      underwater: false,
    })
    expect(stats.skippedNoDate).toBe(1)
    expect(stats.openTotal).toBe(3013)
    expect(stats.medianDays).toBe(11)
  })

  it('drops fully-paid rows, flags underwater (cost > revenue), and fills the 90+ stats', () => {
    const paidJob = job({ id: 'jp', payments: [{ invoice_id: 'p1', amount: 500 }] as never })
    const paidRow = invRow({ id: 'p1', amount: 500, job: paidJob })
    const oldJob = job({ id: 'jo', revenue: 1500 })
    const oldUnderwater = invRow({ id: 'o1', amount: 1500, estimated_bill_date: '2026-04-01', job: oldJob })
    const { points, stats } = buildBilledAgingChart([paidRow, oldUnderwater], { jo: 1900 }, NOW)
    expect(points).toHaveLength(1)
    expect(points[0]!.underwater).toBe(true)
    expect(points[0]!.days).toBeGreaterThanOrEqual(90)
    expect(stats.count90).toBe(1)
    expect(stats.sum90).toBe(1500)
    expect(stats.underwaterCount).toBe(1)
  })

  it('null costs map (no access / not loaded) keeps points with cost null, never underwater', () => {
    const { points } = buildBilledAgingChart([invRow({})], null, NOW)
    expect(points[0]!.cost).toBeNull()
    expect(points[0]!.underwater).toBe(false)
  })
})

describe('scales', () => {
  it('x domain grows in 30-day steps past 120', () => {
    expect(billedAgingXDomainMax([])).toBe(120)
    expect(billedAgingXDomainMax([{ days: 121 } as never])).toBe(150)
  })

  it('x maps linearly and clamps', () => {
    expect(billedAgingX(0, 120, 70, 820)).toBe(70)
    expect(billedAgingX(60, 120, 70, 820)).toBe(445)
    expect(billedAgingX(500, 120, 70, 820)).toBe(820)
  })

  it('y is log with a $100 floor; ticks follow the 1/3 pattern up to the max', () => {
    expect(billedAgingY(BILLED_AGING_Y_FLOOR, 30000, 20, 420)).toBe(420)
    expect(billedAgingY(30000, 30000, 20, 420)).toBe(20)
    const mid = billedAgingY(Math.sqrt(100 * 30000), 30000, 20, 420)
    expect(Math.round(mid)).toBe(220)
    expect(billedAgingYDomainMax([{ open: 18200 } as never])).toBe(30000)
    expect(billedAgingYTicks(30000)).toEqual([100, 300, 1000, 3000, 10000, 30000])
  })

  it('radius is area-proportional with floors', () => {
    expect(billedAgingRadius(null)).toBe(3)
    expect(billedAgingRadius(500)).toBeCloseTo(4.47, 1)
    expect(billedAgingRadius(20000)).toBeCloseTo(28.3, 1)
  })

  it('money labels compact cleanly', () => {
    expect(billedAgingMoneyLabel(100)).toBe('$100')
    expect(billedAgingMoneyLabel(3000)).toBe('$3k')
    expect(billedAgingMoneyLabel(18200)).toBe('$18.2k')
    expect(billedAgingMoneyLabel(224400)).toBe('$224k')
  })
})
