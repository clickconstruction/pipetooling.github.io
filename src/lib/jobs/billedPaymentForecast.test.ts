import { describe, expect, it } from 'vitest'
import {
  bucketKeyForExpected,
  buildBilledPaymentForecast,
  followingBucketTitle,
  forecastWeekStart,
} from './billedPaymentForecast'
import type { PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

// 2026-08-20 is a Thursday; its company week (Sunday start) is Aug 16 – Aug 22.
const TODAY = '2026-08-20'

const speeds: PaySpeedData = {
  company: { medianDays: 27, samples: 240 },
  customers: { knight: { medianDays: 35, samples: 12 } },
  segments: {
    residential: { medianDays: 14, samples: 96 },
    commercial: { medianDays: 38, samples: 131 },
  },
  customerTypes: { knight: 'commercial' },
}

function job(over: Partial<JobWithDetails>): JobWithDetails {
  return {
    id: 'j1',
    hcp_number: '964',
    click_number: null,
    job_name: 'Pondhill demo',
    customer_name: 'Knight Contracting',
    customer_id: 'knight',
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
  billed_at?: string | null
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
      estimated_bill_date: over.estimated_bill_date ?? null,
      billed_at: over.billed_at ?? null,
    },
  } as unknown as StageRow
}

describe('forecastWeekStart / bucketKeyForExpected', () => {
  it('finds the Sunday week start', () => {
    expect(forecastWeekStart('2026-08-20')).toBe('2026-08-16')
    expect(forecastWeekStart('2026-08-16')).toBe('2026-08-16')
    expect(forecastWeekStart('2026-08-22')).toBe('2026-08-16')
  })

  it('buckets by week distance from today', () => {
    expect(bucketKeyForExpected('2026-08-19', TODAY)).toBe('past')
    expect(bucketKeyForExpected('2026-08-20', TODAY)).toBe('thisWeek')
    expect(bucketKeyForExpected('2026-08-22', TODAY)).toBe('thisWeek')
    expect(bucketKeyForExpected('2026-08-23', TODAY)).toBe('nextWeek')
    expect(bucketKeyForExpected('2026-08-29', TODAY)).toBe('nextWeek')
    expect(bucketKeyForExpected('2026-08-30', TODAY)).toBe('following')
    expect(bucketKeyForExpected('2026-09-12', TODAY)).toBe('following')
    expect(bucketKeyForExpected('2026-09-13', TODAY)).toBe('later')
  })

  it('titles the following-two-weeks bucket with its date range', () => {
    expect(followingBucketTitle(TODAY)).toBe('Aug 30 – Sep 12')
  })
})

describe('buildBilledPaymentForecast', () => {
  it('buckets rows by expected date, sums open dollars, and sorts by date', () => {
    // knight pays in ~35d: billed Aug 4 → expected Sep 8 (following bucket).
    const following = invRow({ id: 'a', amount: 3013, billed_at: '2026-08-04T15:00:00Z' })
    // billed Jun 30 → expected Aug 4 → past.
    const past = invRow({ id: 'b', amount: 900, billed_at: '2026-06-30T15:00:00Z', job: job({ id: 'j2' }) })
    // earlier expected date in the same bucket sorts first: billed Aug 1 → Sep 5.
    const followingEarlier = invRow({ id: 'c', amount: 100, billed_at: '2026-08-01T15:00:00Z', job: job({ id: 'j3' }) })
    const f = buildBilledPaymentForecast([following, past, followingEarlier], speeds, TODAY)
    const by = Object.fromEntries(f.buckets.map((b) => [b.key, b]))
    expect(by.past!.rows.map((r) => r.invoiceId)).toEqual(['b'])
    expect(by.following!.rows.map((r) => r.invoiceId)).toEqual(['c', 'a'])
    expect(by.following!.sum).toBe(3113)
    expect(f.openTotal).toBe(4013)
    expect(f.rowCount).toBe(3)
    expect(by.following!.rows.map((r) => r.segment)).toEqual(['commercial', 'commercial'])
  })

  it('rows with no reference date land in the unknown bucket; paid-to-zero rows are skipped and counted', () => {
    const undated = invRow({ id: 'a', amount: 500 })
    const paidOff = invRow({
      id: 'b',
      amount: 900,
      billed_at: '2026-08-04T15:00:00Z',
      job: job({ id: 'j2', payments: [{ invoice_id: 'b', amount: 900, paid_on: '2026-08-10' }] as never }),
    })
    const f = buildBilledPaymentForecast([undated, paidOff], speeds, TODAY)
    const by = Object.fromEntries(f.buckets.map((b) => [b.key, b]))
    expect(by.unknown!.rows.map((r) => r.invoiceId)).toEqual(['a'])
    expect(f.skippedNoMoney).toBe(1)
    expect(f.rowCount).toBe(1)
  })

  it('with no pay-speed data at all, every open row is unknown (still fully listed)', () => {
    const r = invRow({ id: 'a', amount: 500, billed_at: '2026-08-04T15:00:00Z' })
    const f = buildBilledPaymentForecast([r], null, TODAY)
    const by = Object.fromEntries(f.buckets.map((b) => [b.key, b]))
    expect(by.unknown!.rows).toHaveLength(1)
    expect(f.openTotal).toBe(500)
  })

  it('a promised date overrides the estimate and buckets by the promise', () => {
    // knight would estimate Sep 8 (following); the promise says Aug 21 (this week).
    const r = invRow({ id: 'a', amount: 3013, billed_at: '2026-08-04T15:00:00Z' })
    const f = buildBilledPaymentForecast([r], speeds, TODAY, {
      j1: { promisedYmd: '2026-08-21', markedByName: 'Malachi' },
    })
    const by = Object.fromEntries(f.buckets.map((b) => [b.key, b]))
    expect(by.thisWeek!.rows.map((x) => x.invoiceId)).toEqual(['a'])
    expect(by.thisWeek!.rows[0]!.model?.source).toBe('promised')
    expect(by.following!.rows).toHaveLength(0)
  })

  it('bare job rows are ignored (no invoice to anchor a forecast)', () => {
    const bare = { kind: 'job', job: job({}) } as unknown as StageRow
    const f = buildBilledPaymentForecast([bare], speeds, TODAY)
    expect(f.rowCount).toBe(0)
    expect(f.skippedNoMoney).toBe(0)
  })
})
