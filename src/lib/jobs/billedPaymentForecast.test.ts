import { describe, expect, it } from 'vitest'
import {
  bucketKeyForExpected,
  buildBilledPaymentForecast,
  followingBucketTitle,
  forecastWeekStart,
} from './billedPaymentForecast'
import type { PaySpeedData } from './billedExpectedPay'
import { paceContextFor } from './payPace'
import { indexPayCalendars } from './payCalendar'
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
  receipts: {},
  quality: null,
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

  it('a first-job GC’s row buckets by the GC pace here when the forecast is given the facts (v2.6034), by its segment without them', () => {
    // A GC with no history, typed commercial; Knight is the one GC by record with history, so the GC pace here is 35 over 1 payer.
    const typed: PaySpeedData = { ...speeds, customerTypes: { ...speeds.customerTypes, newgc: 'commercial' } }
    const row = invRow({ id: 'g', amount: 5000, billed_at: '2026-08-01T15:00:00Z', job: job({ id: 'j9', customer_id: 'newgc', customer_name: 'New GC' }) })
    const facts = { gcPayerIds: new Set(['knight']), payAppJobIds: new Set(['j9']) }
    const ctx = paceContextFor({ facts, paySpeeds: typed, payerIds: ['knight', 'newgc'] })
    const withFacts = buildBilledPaymentForecast([row, invRow({ id: 'k', billed_at: '2026-08-04T15:00:00Z' })], typed, TODAY, null, null, ctx)
    const g = withFacts.buckets.flatMap((b) => b.rows).find((r) => r.invoiceId === 'g')!
    // Aug 1 + 35 = Sep 5, in the following bucket; the words name the GC pace.
    expect(g.model).toMatchObject({ source: 'gc', medianDays: 35, payers: 1, expectedYmd: '2026-09-05', paceWords: 'the GC pace ~35d over 1 payer' })
    expect(withFacts.buckets.find((b) => b.key === 'following')!.rows.map((r) => r.invoiceId)).toEqual(['g', 'k'])
    const without = buildBilledPaymentForecast([row], typed, TODAY)
    // Aug 1 + 38 (the commercial median) = Sep 8.
    expect(without.buckets.flatMap((b) => b.rows)[0]!.model).toMatchObject({ source: 'segment', medianDays: 38, expectedYmd: '2026-09-08', paceWords: 'commercial pace ~38d' })
  })

  it('a bill an in-kind deal pays is in no week: it is counted apart, since a credit is not money coming (punch list #301)', () => {
    const inKind = invRow({ id: 'k', amount: 1480, billed_at: '2026-01-05T15:00:00Z', job: job({ id: 'j7', in_kind_arrangement_id: 'a1', payments: [{ invoice_id: 'k', amount: 799.5, paid_on: '2026-01-05' }] as never } as never) })
    const cash = invRow({ id: 'c', amount: 500, billed_at: '2026-08-04T15:00:00Z', job: job({ id: 'j8' }) })
    const f = buildBilledPaymentForecast([inKind, cash], speeds, TODAY)
    expect(f.buckets.flatMap((b) => b.rows).map((r) => r.invoiceId)).toEqual(['c'])
    expect(f.openTotal).toBe(500)
    expect(f.rowCount).toBe(1)
    expect(f.inKind).toEqual({ count: 1, dollars: 680.5 })
    expect(buildBilledPaymentForecast([cash], speeds, TODAY).inKind).toEqual({ count: 0, dollars: 0 })
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

describe('usual slip (Their Word PR 3)', () => {
  it('buckets a promised row by the promise plus the customer’s usual slip, and says so on the row', () => {
    // Promised Fri Aug 21 (this week); Knight usually lands 5 days late → Wed Aug 26 = next week's bucket.
    const rows = [invRow({ billed_at: '2026-07-20T12:00:00Z' })]
    const promises = { j1: { promisedYmd: '2026-08-21', markedByName: 'Taunya' } }
    const plain = buildBilledPaymentForecast(rows, speeds, TODAY, promises)
    expect(plain.buckets.find((b) => b.key === 'thisWeek')!.rows).toHaveLength(1)
    expect(plain.buckets.find((b) => b.key === 'thisWeek')!.rows[0]!.slipDays).toBeNull()

    const slipped = buildBilledPaymentForecast(rows, speeds, TODAY, promises, { knight: 5 })
    const row = slipped.buckets.find((b) => b.key === 'nextWeek')!.rows[0]!
    expect(row).toBeDefined()
    expect(row.slipDays).toBe(5)
    expect(row.forecastYmd).toBe('2026-08-26')
    expect(row.model?.expectedYmd).toBe('2026-08-21') // the chip still shows their word
    expect(slipped.buckets.find((b) => b.key === 'thisWeek')!.rows).toHaveLength(0)
  })
  it('ignores the slip for unpromised rows and slips under a day', () => {
    const rows = [invRow({ billed_at: '2026-07-20T12:00:00Z' })]
    const noPromise = buildBilledPaymentForecast(rows, speeds, TODAY, null, { knight: 9 })
    expect(noPromise.rowCount).toBe(1)
    expect(noPromise.buckets.flatMap((b) => b.rows)[0]!.slipDays).toBeNull()
    const tiny = buildBilledPaymentForecast(rows, speeds, TODAY, { j1: { promisedYmd: '2026-08-21', markedByName: 'Taunya' } }, { knight: 0.4 })
    expect(tiny.buckets.find((b) => b.key === 'thisWeek')!.rows[0]!.slipDays).toBeNull()
  })
})

describe('buildBilledPaymentForecast with Pay calendars (punch list #323)', () => {
  // Today is Thursday 2026-11-12: this week is Nov 8 to 14, next week Nov 15 to 21. Larkfield pays the 10th of the
  // month after a bill is in, and runs about 6 days past it; its median pay speed is 41 days.
  const today = '2026-11-12'
  const larkSpeeds: PaySpeedData = {
    company: { medianDays: 12, samples: 200 },
    customers: { lark: { medianDays: 41, samples: 4 }, dana: { medianDays: 10, samples: 5 } },
    segments: { residential: null, commercial: null },
    customerTypes: { lark: 'commercial', dana: 'residential' },
    receipts: {
      lark: [
        { billedYmd: '2026-10-06', paidYmd: '2026-11-10', gapDays: 35, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-10-27', paidYmd: '2026-11-16', gapDays: 20, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-09-03', paidYmd: '2026-10-24', gapDays: 51, jobId: null, jobName: null, address: null },
        { billedYmd: '2026-08-20', paidYmd: '2026-09-16', gapDays: 27, jobId: null, jobName: null, address: null },
      ],
    },
    quality: null,
  }
  const calendars = indexPayCalendars([{ payerCustomerId: 'lark', jobId: null, off: false, calendar: { cutoffDay: null, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '', words: '' }, setByName: null, setAt: null }])
  const billedRow = (j: Partial<JobWithDetails>, inv: { id: string; amount: number; estimated_bill_date: string }): StageRow => invRow({ ...inv, job: job(j) })
  const bills = [
    billedRow({ id: 'j1', customer_id: 'lark', customer_name: 'Larkfield Construction', revenue: 18400 }, { id: 'i1', amount: 18400, estimated_bill_date: '2026-10-06' }),
    billedRow({ id: 'j2', customer_id: 'lark', customer_name: 'Larkfield Construction', revenue: 22750 }, { id: 'i2', amount: 22750, estimated_bill_date: '2026-10-27' }),
    billedRow({ id: 'j3', customer_id: 'lark', customer_name: 'Larkfield Construction', revenue: 9600 }, { id: 'i3', amount: 9600, estimated_bill_date: '2026-11-03' }),
    billedRow({ id: 'j4', customer_id: 'dana', customer_name: 'Dana Whitfield', revenue: 1840 }, { id: 'i4', amount: 1840, estimated_bill_date: '2026-11-03' }),
  ]
  const sums = (f: ReturnType<typeof buildBilledPaymentForecast>) => Object.fromEntries(f.buckets.filter((b) => b.rows.length).map((b) => [b.key, b.sum]))

  it('without calendars three bills from one payer land on three dates', () => {
    const f = buildBilledPaymentForecast(bills, larkSpeeds, today)
    expect(sums(f)).toEqual({ thisWeek: 1840, nextWeek: 18400, later: 32350 })
  })

  it('with the calendar the two October bills share a due day and a week, and each row carries its due day', () => {
    const f = buildBilledPaymentForecast(bills, larkSpeeds, today, null, null, null, calendars)
    expect(sums(f)).toEqual({ thisWeek: 1840, nextWeek: 41150, later: 9600 })
    const next = f.buckets.find((b) => b.key === 'nextWeek')!.rows
    expect(next.map((r) => [r.invoiceId, r.model?.source, r.model?.dueYmd, r.model?.daysPastDue, r.forecastYmd])).toEqual([
      ['i2', 'terms', '2026-11-10', 2, '2026-11-16'],
      ['i1', 'terms', '2026-11-10', 2, '2026-11-16'],
    ])
    const later = f.buckets.find((b) => b.key === 'later')!.rows[0]!
    expect([later.model?.dueYmd, later.forecastYmd]).toEqual(['2026-12-10', '2026-12-16'])
    // A payer with no calendar reads as before.
    const dana = f.buckets.find((b) => b.key === 'thisWeek')!.rows[0]!
    expect([dana.model?.source, dana.model?.dueYmd, dana.forecastYmd]).toEqual(['customer', null, '2026-11-13'])
    expect(f.openTotal).toBe(52590)
  })
})
