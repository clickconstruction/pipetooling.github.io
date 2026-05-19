import { describe, expect, it } from 'vitest'
import {
  buildDayCostBreakdown,
  computeDayLaborCost,
  computeDayLaborLines,
  computeDayMercuryCost,
  computeDayMercuryLines,
  computeDaySupplyCost,
  computeDaySupplyLines,
  formatUsd,
} from './projectsJobHistoryDayCosts'

// Helper: build an ISO string a known number of hours apart so we can predict labor in tests.
function isoHoursApart(startIso: string, hours: number): string {
  const start = new Date(startIso).getTime()
  return new Date(start + hours * 3600 * 1000).toISOString()
}

describe('computeDayLaborCost', () => {
  it('sums hours × wage when every session has a known wage', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 2) },
      { user_id: 'u2', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 4.5) },
    ]
    const names = new Map([
      ['u1', 'Abraham'],
      ['u2', 'Bryan'],
    ])
    const wages = new Map<string, number | null>([
      ['abraham', 25],
      ['bryan', 30],
    ])
    const r = computeDayLaborCost(sessions, names, wages)
    expect(r.usd).toBeCloseTo(2 * 25 + 4.5 * 30, 6)
    expect(r.missingWageNames).toEqual([])
    expect(r.incomplete).toBe(false)
  })

  it('flags users missing from people_pay_config and continues', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 2) },
      { user_id: 'u2', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 3) },
    ]
    const names = new Map([
      ['u1', 'Abraham'],
      ['u2', 'NoWage'],
    ])
    const wages = new Map<string, number | null>([['abraham', 25]])
    const r = computeDayLaborCost(sessions, names, wages)
    expect(r.usd).toBeCloseTo(2 * 25, 6)
    expect(r.missingWageNames).toEqual(['NoWage'])
    expect(r.incomplete).toBe(true)
  })

  it('treats a null hourly_wage as missing (not as $0 contribution)', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 8) },
    ]
    const names = new Map([['u1', 'Abraham']])
    const wages = new Map<string, number | null>([['abraham', null]])
    const r = computeDayLaborCost(sessions, names, wages)
    expect(r.usd).toBe(0)
    expect(r.missingWageNames).toEqual(['Abraham'])
    expect(r.incomplete).toBe(true)
  })

  it('skips open sessions but marks the total incomplete', () => {
    const sessions = [
      {
        user_id: 'u1',
        clocked_in_at: '2026-05-18T13:00:00.000Z',
        clocked_out_at: isoHoursApart('2026-05-18T13:00:00.000Z', 1),
      },
      {
        user_id: 'u1',
        clocked_in_at: '2026-05-18T20:00:00.000Z',
        clocked_out_at: null,
      },
    ]
    const names = new Map([['u1', 'Abraham']])
    const wages = new Map<string, number | null>([['abraham', 20]])
    const r = computeDayLaborCost(sessions, names, wages)
    expect(r.usd).toBeCloseTo(1 * 20, 6)
    expect(r.incomplete).toBe(true)
    expect(r.missingWageNames).toEqual([])
  })

  it('matches wage by normalized name (trim + lowercase)', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1) },
    ]
    const names = new Map([['u1', '  Abraham  ']])
    const wages = new Map<string, number | null>([['abraham', 40]])
    const r = computeDayLaborCost(sessions, names, wages)
    expect(r.usd).toBeCloseTo(40, 6)
    expect(r.missingWageNames).toEqual([])
    expect(r.incomplete).toBe(false)
  })

  it('returns zero / not-incomplete on empty session list', () => {
    const r = computeDayLaborCost([], new Map(), new Map())
    expect(r.usd).toBe(0)
    expect(r.missingWageNames).toEqual([])
    expect(r.incomplete).toBe(false)
  })

  it('deduplicates missing wage names across multiple sessions', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1) },
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 2) },
    ]
    const names = new Map([['u1', 'NoWage']])
    const r = computeDayLaborCost(sessions, names, new Map())
    expect(r.missingWageNames).toEqual(['NoWage'])
  })
})

describe('computeDayMercuryCost', () => {
  it('includes only transactions posted on the Chicago work_date', () => {
    // 2026-05-18T16:00:00Z is 11:00 AM in Chicago (CDT) — Chicago date is 2026-05-18.
    // 2026-05-19T03:00:00Z is 10:00 PM Chicago on 2026-05-18 (CDT).
    // 2026-05-19T06:00:00Z is 01:00 AM Chicago on 2026-05-19.
    const allocations = [
      { amount: 100, posted_at: '2026-05-18T16:00:00.000Z' },
      { amount: 75.5, posted_at: '2026-05-19T03:00:00.000Z' },
      { amount: 9999, posted_at: '2026-05-19T06:00:00.000Z' },
    ]
    expect(computeDayMercuryCost(allocations, '2026-05-18')).toBeCloseTo(175.5, 6)
  })

  it('uses absolute value so negative (refund) and positive (debit) both add to the magnitude', () => {
    const allocations = [
      { amount: 100, posted_at: '2026-05-18T16:00:00.000Z' },
      { amount: -25, posted_at: '2026-05-18T17:00:00.000Z' },
    ]
    expect(computeDayMercuryCost(allocations, '2026-05-18')).toBeCloseTo(125, 6)
  })

  it('skips rows missing posted_at or with bad amounts silently', () => {
    const allocations = [
      { amount: 50, posted_at: '2026-05-18T16:00:00.000Z' },
      { amount: 'not a number' as unknown as string, posted_at: '2026-05-18T17:00:00.000Z' },
      { amount: 75, posted_at: null },
    ]
    expect(computeDayMercuryCost(allocations, '2026-05-18')).toBeCloseTo(50, 6)
  })

  it('returns 0 when there are no allocations', () => {
    expect(computeDayMercuryCost([], '2026-05-18')).toBe(0)
  })
})

describe('computeDaySupplyCost', () => {
  it('sums pct × invoice_amount across matching invoice_date rows', () => {
    const allocations = [
      { pct: 50, invoice_amount: 200, invoice_date: '2026-05-18' },
      { pct: 100, invoice_amount: 75, invoice_date: '2026-05-18' },
      { pct: 25, invoice_amount: 400, invoice_date: '2026-05-19' },
    ]
    expect(computeDaySupplyCost(allocations, '2026-05-18')).toBeCloseTo(100 + 75, 6)
  })

  it('handles string-encoded numeric values from supabase', () => {
    const allocations = [
      { pct: '50', invoice_amount: '200', invoice_date: '2026-05-18' },
    ]
    expect(computeDaySupplyCost(allocations, '2026-05-18')).toBeCloseTo(100, 6)
  })

  it('accepts a long ISO date and truncates to YYYY-MM-DD before comparing', () => {
    const allocations = [
      { pct: 100, invoice_amount: 50, invoice_date: '2026-05-18T00:00:00Z' },
    ]
    expect(computeDaySupplyCost(allocations, '2026-05-18')).toBeCloseTo(50, 6)
  })

  it('skips rows with no / malformed invoice_date', () => {
    const allocations = [
      { pct: 100, invoice_amount: 50, invoice_date: null },
      { pct: 100, invoice_amount: 50, invoice_date: 'garbage' },
    ]
    expect(computeDaySupplyCost(allocations, '2026-05-18')).toBe(0)
  })

  it('returns 0 when there are no allocations', () => {
    expect(computeDaySupplyCost([], '2026-05-18')).toBe(0)
  })
})

describe('computeDayLaborLines', () => {
  it('aggregates hours per user and looks up wages', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 2) },
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1.5) },
      { user_id: 'u2', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 4) },
    ]
    const names = new Map([
      ['u1', 'Abraham'],
      ['u2', 'Bryan'],
    ])
    const wages = new Map<string, number | null>([
      ['abraham', 25],
      ['bryan', 30],
    ])
    const lines = computeDayLaborLines(sessions, names, wages)
    expect(lines).toHaveLength(2)
    const abraham = lines.find((l) => l.userId === 'u1')!
    expect(abraham.hours).toBeCloseTo(3.5, 6)
    expect(abraham.hourlyWage).toBe(25)
    expect(abraham.usd).toBeCloseTo(87.5, 6)
    expect(abraham.hasOpenSession).toBe(false)
    const bryan = lines.find((l) => l.userId === 'u2')!
    expect(bryan.hours).toBeCloseTo(4, 6)
    expect(bryan.usd).toBeCloseTo(120, 6)
  })

  it('sorts rows alphabetically by user name', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u2', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1) },
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1) },
    ]
    const names = new Map([
      ['u1', 'Zara'],
      ['u2', 'Alice'],
    ])
    const lines = computeDayLaborLines(sessions, names, new Map())
    expect(lines.map((l) => l.userName)).toEqual(['Alice', 'Zara'])
  })

  it('flips `hasOpenSession` and skips the open session hours, but still uses other-session hours', () => {
    const closedStart = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: closedStart, clocked_out_at: isoHoursApart(closedStart, 2) },
      { user_id: 'u1', clocked_in_at: '2026-05-18T20:00:00.000Z', clocked_out_at: null },
    ]
    const names = new Map([['u1', 'Abraham']])
    const wages = new Map<string, number | null>([['abraham', 20]])
    const lines = computeDayLaborLines(sessions, names, wages)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.hours).toBeCloseTo(2, 6)
    expect(lines[0]!.usd).toBeCloseTo(40, 6)
    expect(lines[0]!.hasOpenSession).toBe(true)
  })

  it('returns hourlyWage=null and usd=0 when no pay config exists for the user', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 3) },
    ]
    const names = new Map([['u1', 'NoWage']])
    const lines = computeDayLaborLines(sessions, names, new Map())
    expect(lines).toHaveLength(1)
    expect(lines[0]!.hourlyWage).toBeNull()
    expect(lines[0]!.usd).toBe(0)
    expect(lines[0]!.hours).toBeCloseTo(3, 6)
  })

  it('falls back to "Unknown user" when display name is missing', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const sessions = [
      { user_id: 'u-ghost', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 1) },
    ]
    const lines = computeDayLaborLines(sessions, new Map(), new Map())
    expect(lines[0]!.userName).toBe('Unknown user')
  })
})

describe('computeDayMercuryLines', () => {
  it('emits one row per matching allocation, sorted newest-first by posted_at', () => {
    const allocations = [
      {
        amount: 100,
        posted_at: '2026-05-18T16:00:00.000Z',
        counterparty_name: 'Home Depot',
        note: 'PVC',
      },
      {
        amount: 50,
        posted_at: '2026-05-18T18:00:00.000Z',
        counterparty_name: 'Ferguson',
        note: null,
      },
      {
        amount: 9999,
        posted_at: '2026-05-19T06:00:00.000Z',
        counterparty_name: 'Should be filtered',
        note: null,
      },
    ]
    const lines = computeDayMercuryLines(allocations, '2026-05-18')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.counterpartyName).toBe('Ferguson')
    expect(lines[1]!.counterpartyName).toBe('Home Depot')
    expect(lines[0]!.amountUsd).toBeCloseTo(50, 6)
    expect(lines[1]!.amountUsd).toBeCloseTo(100, 6)
    expect(lines[1]!.note).toBe('PVC')
  })

  it('keeps negative amounts as positive magnitudes', () => {
    const lines = computeDayMercuryLines(
      [{ amount: -75, posted_at: '2026-05-18T16:00:00.000Z' }],
      '2026-05-18',
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]!.amountUsd).toBeCloseTo(75, 6)
  })

  it('drops rows without posted_at or with unparseable amounts', () => {
    const lines = computeDayMercuryLines(
      [
        { amount: 50, posted_at: null },
        { amount: 'oops' as unknown as string, posted_at: '2026-05-18T16:00:00.000Z' },
      ],
      '2026-05-18',
    )
    expect(lines).toEqual([])
  })
})

describe('computeDaySupplyLines', () => {
  it('emits one row per matching allocation with computed allocatedUsd', () => {
    const allocations = [
      {
        pct: 50,
        invoice_amount: 200,
        invoice_date: '2026-05-18',
        invoice_number: 'INV-100',
        supply_house_name: 'Ferguson',
      },
      {
        pct: 100,
        invoice_amount: 75,
        invoice_date: '2026-05-18',
        invoice_number: 'INV-50',
        supply_house_name: 'Acme',
      },
      {
        pct: 25,
        invoice_amount: 400,
        invoice_date: '2026-05-19',
        invoice_number: 'INV-X',
        supply_house_name: 'Other',
      },
    ]
    const lines = computeDaySupplyLines(allocations, '2026-05-18')
    expect(lines).toHaveLength(2)
    // Sorted by supply house name → Acme, Ferguson
    expect(lines[0]!.supplyHouseName).toBe('Acme')
    expect(lines[0]!.allocatedUsd).toBeCloseTo(75, 6)
    expect(lines[1]!.supplyHouseName).toBe('Ferguson')
    expect(lines[1]!.allocatedUsd).toBeCloseTo(100, 6)
    expect(lines[1]!.invoiceTotalUsd).toBe(200)
    expect(lines[1]!.pct).toBe(50)
  })

  it('drops rows with malformed dates', () => {
    const lines = computeDaySupplyLines(
      [
        { pct: 100, invoice_amount: 50, invoice_date: null },
        { pct: 100, invoice_amount: 50, invoice_date: 'garbage' },
      ],
      '2026-05-18',
    )
    expect(lines).toEqual([])
  })
})

describe('buildDayCostBreakdown', () => {
  it('combines all three categories into a single total and exposes detail lines', () => {
    const start = '2026-05-18T13:00:00.000Z'
    const r = buildDayCostBreakdown({
      sessions: [
        { user_id: 'u1', clocked_in_at: start, clocked_out_at: isoHoursApart(start, 2) },
      ],
      userNamesById: new Map([['u1', 'Abraham']]),
      wageByNormalizedName: new Map<string, number | null>([['abraham', 25]]),
      mercuryAllocations: [
        { amount: 75, posted_at: '2026-05-18T16:00:00.000Z', counterparty_name: 'Home Depot' },
      ],
      supplyAllocations: [
        {
          pct: 50,
          invoice_amount: 200,
          invoice_date: '2026-05-18',
          invoice_number: 'INV-1',
          supply_house_name: 'Ferguson',
        },
      ],
      workDateYmd: '2026-05-18',
    })
    expect(r.laborUsd).toBeCloseTo(50, 6)
    expect(r.mercuryUsd).toBeCloseTo(75, 6)
    expect(r.supplyUsd).toBeCloseTo(100, 6)
    expect(r.totalUsd).toBeCloseTo(225, 6)
    expect(r.laborMissingWageNames).toEqual([])
    expect(r.laborIncomplete).toBe(false)
    expect(r.laborLines).toHaveLength(1)
    expect(r.laborLines[0]!.userName).toBe('Abraham')
    expect(r.laborLines[0]!.usd).toBeCloseTo(50, 6)
    expect(r.mercuryLines).toHaveLength(1)
    expect(r.mercuryLines[0]!.counterpartyName).toBe('Home Depot')
    expect(r.supplyLines).toHaveLength(1)
    expect(r.supplyLines[0]!.invoiceNumber).toBe('INV-1')
    expect(r.supplyLines[0]!.allocatedUsd).toBeCloseTo(100, 6)
  })
})

describe('formatUsd', () => {
  it('formats whole dollars with cents', () => {
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
    expect(formatUsd(1234.567)).toBe('$1,234.57')
  })

  it('returns em-dash on NaN / Infinity', () => {
    expect(formatUsd(Number.NaN)).toBe('—')
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('—')
  })
})
