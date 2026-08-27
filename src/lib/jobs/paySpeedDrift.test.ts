import { describe, expect, it } from 'vitest'
import { buildPayDrift } from './paySpeedDrift'
import type { PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const TODAY = '2026-08-26'

function receipt(gapDays: number, paidYmd: string) {
  return { billedYmd: '2026-06-01', paidYmd, gapDays, jobId: null, jobName: null, address: null }
}

function speeds(overrides?: Partial<PaySpeedData>): PaySpeedData {
  return {
    company: { medianDays: 6, samples: 153 },
    customers: {
      knight: { medianDays: 25, samples: 7 },
      berg: { medianDays: 4, samples: 4 },
      holub: { medianDays: 30, samples: 1 }, // thin — under the 3-sample floor
    },
    segments: { residential: null, commercial: null },
    customerTypes: { knight: 'commercial', berg: 'residential' },
    receipts: {
      // newest paid first; last 3 for knight: 34, 31, 28 → median 31
      knight: [receipt(34, '2026-08-20'), receipt(31, '2026-08-01'), receipt(28, '2026-07-10'), receipt(9, '2026-05-01')],
      // berg's recent form beats his median: 1, 2, 3 → median 2 vs baseline 4
      berg: [receipt(1, '2026-08-18'), receipt(2, '2026-08-02'), receipt(3, '2026-07-21')],
    },
    quality: null,
    ...overrides,
  }
}

/** One open invoice row: billed `billedYmd`, `amount` open. */
function invRow(customerId: string, name: string, amount: number, billedYmd: string): StageRow {
  const job = {
    id: `j-${customerId}-${billedYmd}`,
    customer_id: customerId,
    customer_name: name,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: {
      id: `inv-${customerId}-${billedYmd}`,
      job_id: job.id,
      amount,
      status: 'billed',
      sequence_order: 1,
      billed_at: `${billedYmd}T12:00:00Z`,
    },
  } as unknown as StageRow
}

describe('buildPayDrift', () => {
  it('live open-bill wait past the baseline wins over recent form when worse', () => {
    // Knight baseline 25d; oldest open bill billed 51 days ago → live +26 beats recent +6.
    const d = buildPayDrift(
      [invRow('knight', 'Knight Contracting', 8317, '2026-07-06'), invRow('knight', 'Knight Contracting', 3600, '2026-08-10')],
      speeds(),
      TODAY,
    )!
    expect(d.rows).toHaveLength(1)
    expect(d.rows[0]).toMatchObject({
      customerId: 'knight',
      ownMedianDays: 25,
      baselineDays: 25,
      deltaDays: 26,
      currentDays: 51,
      deltaVsCompanyDays: 45,
      source: 'live',
      open: 11917,
    })
  })

  it('recent completed payments are the only source of a below-average (negative) delta', () => {
    // Berg baseline 4d; open bill billed yesterday (wait 1d < baseline says nothing);
    // recent median 2d → −2 vs his average.
    const d = buildPayDrift([invRow('berg', 'Aaron Berg', 185, '2026-08-25')], speeds(), TODAY)!
    expect(d.rows[0]).toMatchObject({ deltaDays: -2, currentDays: 2, deltaVsCompanyDays: -4, source: 'recent' })
  })

  it('recent form drives a positive delta when no open bill has outwaited the baseline', () => {
    // Knight bill billed 10 days ago (wait < 25d baseline) — but recent median 31 → +6.
    const d = buildPayDrift([invRow('knight', 'Knight Contracting', 1000, '2026-08-16')], speeds(), TODAY)!
    expect(d.rows[0]).toMatchObject({ deltaDays: 6, source: 'recent' })
  })

  it('thin-history customers baseline on the company median and only move via live waits', () => {
    // Holub: 1 sample → thin. Bill waited 20d vs company 6d → +14, ownMedianDays null.
    const d = buildPayDrift([invRow('holub', 'Michael Holub', 2375, '2026-08-06')], speeds(), TODAY)!
    expect(d.rows[0]).toMatchObject({ ownMedianDays: null, baselineDays: 6, deltaDays: 14, source: 'live', samples: 1 })
  })

  it('customers at their baseline collapse into the on-pace line', () => {
    // No receipts entry → no recent form; bill wait 3d < 6d company baseline.
    const noRecent = speeds({ receipts: {} })
    const d = buildPayDrift(
      [invRow('other', 'On Pace LLC', 500, '2026-08-23'), invRow('holub', 'Michael Holub', 2375, '2026-08-06')],
      noRecent,
      TODAY,
    )!
    expect(d.rows.map((r) => r.customerId)).toEqual(['holub'])
    expect(d.onPaceCount).toBe(1)
    expect(d.onPaceOpen).toBe(500)
  })

  it('sorts worst drift first, ties broken by open dollars', () => {
    const d = buildPayDrift(
      [
        invRow('berg', 'Aaron Berg', 185, '2026-08-25'),
        invRow('knight', 'Knight Contracting', 8317, '2026-07-06'),
        invRow('holub', 'Michael Holub', 2375, '2026-08-06'),
      ],
      speeds(),
      TODAY,
    )!
    expect(d.rows.map((r) => r.customerId)).toEqual(['knight', 'holub', 'berg'])
    expect(d.companyMedianDays).toBe(6)
  })

  it('returns null without a company median (nothing to baseline thin history against)', () => {
    expect(buildPayDrift([invRow('knight', 'Knight', 100, '2026-08-01')], speeds({ company: null }), TODAY)).toBeNull()
    expect(buildPayDrift([invRow('knight', 'Knight', 100, '2026-08-01')], null, TODAY)).toBeNull()
  })
})
