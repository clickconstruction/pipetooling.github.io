import { describe, expect, it } from 'vitest'
import {
  bidEstimatorsWindowStartYmd,
  buildBidEstimatorsCellMap,
  buildBidEstimatorsCostModeChip,
  buildBidEstimatorsWindowDays,
  distinctBidIdsFromWindowRows,
  formatBidEstimatorsCellHours,
  formatBidEstimatorsCellPercent,
  formatBidEstimatorsProjectNameClip,
  formatBidValueK,
  lookupBidEstimatorsCell,
  type BidEstimatorsAllTimeHoursRow,
  type BidEstimatorsWindowHoursRow,
} from './bidEstimatorsTab'

describe('buildBidEstimatorsWindowDays', () => {
  it('returns descending YYYY-MM-DD list of length N starting at today', () => {
    const days = buildBidEstimatorsWindowDays('2026-05-15', 3)
    expect(days).toEqual(['2026-05-15', '2026-05-14', '2026-05-13'])
  })

  it('defaults to 30 entries', () => {
    const days = buildBidEstimatorsWindowDays('2026-05-15')
    expect(days).toHaveLength(30)
    expect(days[0]).toBe('2026-05-15')
    expect(days[29]).toBe('2026-04-16')
  })

  it('returns empty array when windowDays <= 0', () => {
    expect(buildBidEstimatorsWindowDays('2026-05-15', 0)).toEqual([])
  })
})

describe('bidEstimatorsWindowStartYmd', () => {
  it('30-day window starts 29 days back', () => {
    expect(bidEstimatorsWindowStartYmd('2026-05-15', 30)).toBe('2026-04-16')
  })

  it('1-day window equals today', () => {
    expect(bidEstimatorsWindowStartYmd('2026-05-15', 1)).toBe('2026-05-15')
  })
})

describe('buildBidEstimatorsCellMap', () => {
  const windowRows: BidEstimatorsWindowHoursRow[] = [
    { user_id: 'u1', bid_id: 'b1', work_date: '2026-05-15', hours: 2 },
    { user_id: 'u1', bid_id: 'b2', work_date: '2026-05-15', hours: 1 },
    { user_id: 'u2', bid_id: 'b1', work_date: '2026-05-15', hours: 3 },
    { user_id: 'u1', bid_id: 'b1', work_date: '2026-05-14', hours: 4 },
  ]
  const allTimeRows: BidEstimatorsAllTimeHoursRow[] = [
    { bid_id: 'b1', hours: 20 },
    { bid_id: 'b2', hours: 5 },
  ]

  it('computes percentage as hoursOnDay / allTimeHours × 100', () => {
    const cells = buildBidEstimatorsCellMap(windowRows, allTimeRows)
    const u1Today = lookupBidEstimatorsCell(cells, 'u1', '2026-05-15')
    // b1: 2h / 20h = 10%, b2: 1h / 5h = 20% → sorted by hoursOnDay desc → b1 first
    expect(u1Today.map((e) => ({ bidId: e.bidId, pct: e.pctOfBidAllTime }))).toEqual([
      { bidId: 'b1', pct: 10 },
      { bidId: 'b2', pct: 20 },
    ])
  })

  it('keys are independent per user and per day', () => {
    const cells = buildBidEstimatorsCellMap(windowRows, allTimeRows)
    expect(lookupBidEstimatorsCell(cells, 'u2', '2026-05-15')).toHaveLength(1)
    expect(lookupBidEstimatorsCell(cells, 'u1', '2026-05-14')).toHaveLength(1)
    expect(lookupBidEstimatorsCell(cells, 'u2', '2026-05-14')).toEqual([])
  })

  it('falls back to hoursOnDay as denominator when bid all-time row is missing', () => {
    const cells = buildBidEstimatorsCellMap(
      [{ user_id: 'u1', bid_id: 'b3', work_date: '2026-05-15', hours: 7 }],
      [],
    )
    const cell = lookupBidEstimatorsCell(cells, 'u1', '2026-05-15')
    expect(cell).toHaveLength(1)
    expect(cell[0]!.bidAllTimeHours).toBe(7)
    expect(cell[0]!.pctOfBidAllTime).toBe(100)
  })

  it('drops rows with non-positive hours', () => {
    const cells = buildBidEstimatorsCellMap(
      [
        { user_id: 'u1', bid_id: 'b1', work_date: '2026-05-15', hours: 0 },
        { user_id: 'u1', bid_id: 'b1', work_date: '2026-05-15', hours: -1 },
      ],
      [{ bid_id: 'b1', hours: 10 }],
    )
    expect(lookupBidEstimatorsCell(cells, 'u1', '2026-05-15')).toEqual([])
  })
})

describe('distinctBidIdsFromWindowRows', () => {
  it('returns unique bid ids', () => {
    const rows: BidEstimatorsWindowHoursRow[] = [
      { user_id: 'u1', bid_id: 'b1', work_date: '2026-05-15', hours: 1 },
      { user_id: 'u2', bid_id: 'b1', work_date: '2026-05-14', hours: 2 },
      { user_id: 'u1', bid_id: 'b2', work_date: '2026-05-13', hours: 3 },
    ]
    expect(distinctBidIdsFromWindowRows(rows).sort()).toEqual(['b1', 'b2'])
  })
})

describe('formatBidEstimatorsCellPercent', () => {
  it('rounds to nearest integer with % suffix', () => {
    expect(formatBidEstimatorsCellPercent(40.4)).toBe('40%')
    expect(formatBidEstimatorsCellPercent(40.6)).toBe('41%')
    expect(formatBidEstimatorsCellPercent(0)).toBe('0%')
  })

  it('returns em dash for null', () => {
    expect(formatBidEstimatorsCellPercent(null)).toBe('\u2014')
  })
})

describe('formatBidEstimatorsCellHours', () => {
  it('formats with one decimal place', () => {
    expect(formatBidEstimatorsCellHours(2)).toBe('2.0h')
    expect(formatBidEstimatorsCellHours(0.25)).toBe('0.3h')
  })

  it('returns 0h for non-positive', () => {
    expect(formatBidEstimatorsCellHours(0)).toBe('0h')
    expect(formatBidEstimatorsCellHours(-1)).toBe('0h')
  })
})

describe('formatBidValueK', () => {
  it('rounds whole-dollar values to nearest thousand with k suffix', () => {
    expect(formatBidValueK(30000)).toBe('30k')
    expect(formatBidValueK(29500)).toBe('30k')
    expect(formatBidValueK(29499)).toBe('29k')
  })

  it('zero returns 0k', () => {
    expect(formatBidValueK(0)).toBe('0k')
  })

  it('sub-$1000 values keep one decimal', () => {
    expect(formatBidValueK(500)).toBe('0.5k')
    expect(formatBidValueK(50)).toBe('0.1k')
  })

  it('negative values get a leading dash', () => {
    expect(formatBidValueK(-30000)).toBe('-30k')
  })

  it('large values get thousands separators on the k portion', () => {
    expect(formatBidValueK(1_500_000)).toBe('1,500k')
  })

  it('non-finite returns 0k', () => {
    expect(formatBidValueK(Number.NaN)).toBe('0k')
    expect(formatBidValueK(Number.POSITIVE_INFINITY)).toBe('0k')
  })
})

describe('buildBidEstimatorsCostModeChip', () => {
  it('returns missing when bid value is null or undefined', () => {
    expect(buildBidEstimatorsCostModeChip(null, 50)).toEqual({ kind: 'missing' })
    expect(buildBidEstimatorsCostModeChip(undefined, 50)).toEqual({ kind: 'missing' })
  })

  it('returns missing when bid value is non-finite', () => {
    expect(buildBidEstimatorsCostModeChip(Number.NaN, 50)).toEqual({ kind: 'missing' })
  })

  it('scales bid value by pct / 100', () => {
    expect(buildBidEstimatorsCostModeChip(30000, 50)).toEqual({
      kind: 'value',
      scaledDollars: 15000,
      totalDollars: 30000,
    })
    expect(buildBidEstimatorsCostModeChip(30000, 100)).toEqual({
      kind: 'value',
      scaledDollars: 30000,
      totalDollars: 30000,
    })
  })

  it('treats null pct as 0% so scaled=0 but total still rendered', () => {
    expect(buildBidEstimatorsCostModeChip(30000, null)).toEqual({
      kind: 'value',
      scaledDollars: 0,
      totalDollars: 30000,
    })
  })
})

describe('formatBidEstimatorsProjectNameClip', () => {
  it('appends three dots when name exceeds max chars', () => {
    expect(formatBidEstimatorsProjectNameClip('Take 5 Oil Change')).toBe('Take 5 Oil...')
  })

  it('returns name unchanged when within limit', () => {
    expect(formatBidEstimatorsProjectNameClip('Short')).toBe('Short')
  })

  it('returns name unchanged at exactly max chars (no ellipsis)', () => {
    expect(formatBidEstimatorsProjectNameClip('Take 5 Oil')).toBe('Take 5 Oil')
  })

  it('trims surrounding whitespace before measuring', () => {
    expect(formatBidEstimatorsProjectNameClip('  Take 5 Oil Change  ')).toBe('Take 5 Oil...')
  })

  it('returns empty string for empty/nullish input', () => {
    expect(formatBidEstimatorsProjectNameClip('')).toBe('')
    expect(formatBidEstimatorsProjectNameClip(null)).toBe('')
    expect(formatBidEstimatorsProjectNameClip(undefined)).toBe('')
  })

  it('honors a custom max', () => {
    expect(formatBidEstimatorsProjectNameClip('Take 5 Oil Change', 4)).toBe('Take...')
  })
})
