import { describe, expect, it } from 'vitest'
import { billWaitTone, buildMoneyWaiting, openBillsForCustomers } from './moneyWaiting'
import type { PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const TODAY = '2026-08-26'

function speeds(overrides?: Partial<PaySpeedData>): PaySpeedData {
  return {
    company: { medianDays: 6, samples: 153 },
    customers: {
      rmc: { medianDays: 35, samples: 5 },
      ingram: { medianDays: 8, samples: 4 },
      holub: { medianDays: 30, samples: 1 }, // thin — under the 3-sample floor
    },
    segments: { residential: null, commercial: null },
    customerTypes: { rmc: 'commercial', ingram: 'residential' },
    receipts: {},
    quality: null,
    ...overrides,
  }
}

/** One open invoice row: billed `billedYmd` (null = undated), `amount` open. */
function invRow(customerId: string, name: string, amount: number, billedYmd: string | null, jobName = 'Job', address = '123 Main'): StageRow {
  const job = {
    id: `j-${customerId}-${billedYmd ?? 'undated'}-${jobName}`,
    customer_id: customerId,
    customer_name: name,
    job_name: jobName,
    job_address: address,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: {
      id: `inv-${job.id}`,
      job_id: job.id,
      amount,
      status: 'billed',
      sequence_order: 1,
      billed_at: billedYmd ? `${billedYmd}T12:00:00Z` : null,
    },
  } as unknown as StageRow
}

describe('billWaitTone', () => {
  it('reads ok at/under baseline, warn over, late at 2x, undated without a date', () => {
    expect(billWaitTone(35, 35)).toBe('ok')
    expect(billWaitTone(36, 35)).toBe('warn')
    expect(billWaitTone(70, 35)).toBe('late')
    expect(billWaitTone(null, 35)).toBe('undated')
  })
})

describe('buildMoneyWaiting', () => {
  it('groups a customer’s open bills, longest wait first, and sorts customers slowest first', () => {
    const m = buildMoneyWaiting(
      [
        // RMC: baseline 35 — bills waited 164d (3/15), 41d (7/16)
        invRow('rmc', 'RMC- Dudley Mason', 13700, '2026-03-15', 'Ph 2 rough'),
        invRow('rmc', 'RMC- Dudley Mason', 2750, '2026-07-16', 'Trim set'),
        // Ingram: baseline 8 — one bill waited 83d
        invRow('ingram', 'Johnny Ingram', 4120, '2026-06-04', 'Repipe'),
      ],
      speeds(),
      TODAY,
    )
    expect(m).not.toBeNull()
    expect(m!.rows.map((r) => r.customerId)).toEqual(['rmc', 'ingram'])
    const rmc = m!.rows[0]!
    expect(rmc.oldestWaitDays).toBe(164)
    expect(rmc.baselineDays).toBe(35)
    expect(rmc.open).toBe(16450)
    expect(rmc.bills.map((b) => [b.jobName, b.waitDays, b.tone])).toEqual([
      ['Ph 2 rough', 164, 'late'],
      ['Trim set', 41, 'warn'],
    ])
  })

  it('a customer whose oldest bill is at/under baseline collapses into the on-pace line', () => {
    const m = buildMoneyWaiting([invRow('rmc', 'RMC', 5000, '2026-08-01')], speeds(), TODAY)
    expect(m!.rows).toEqual([])
    expect(m!.onPaceCount).toBe(1)
    expect(m!.onPaceOpen).toBe(5000)
  })

  it('thin-history customers baseline on the company median and report ownMedianDays null', () => {
    const m = buildMoneyWaiting([invRow('holub', 'Holub', 900, '2026-08-10')], speeds(), TODAY)
    const row = m!.rows[0]!
    expect(row.ownMedianDays).toBeNull()
    expect(row.baselineDays).toBe(6)
    expect(row.oldestWaitDays).toBe(16)
    expect(row.bills[0]!.tone).toBe('late') // 16 ≥ 2×6
  })

  it('undated bills never set the pace but still list (last, toned undated)', () => {
    const m = buildMoneyWaiting(
      [invRow('ingram', 'Johnny Ingram', 4120, '2026-06-04', 'Repipe'), invRow('ingram', 'Johnny Ingram', 800, null, 'Old import')],
      speeds(),
      TODAY,
    )
    const row = m!.rows[0]!
    expect(row.oldestWaitDays).toBe(83)
    expect(row.open).toBe(4920)
    expect(row.bills.map((b) => [b.jobName, b.tone])).toEqual([
      ['Repipe', 'late'],
      ['Old import', 'undated'],
    ])
  })

  it('a customer with only undated bills is on-pace (nothing measurable to chase)', () => {
    const m = buildMoneyWaiting([invRow('rmc', 'RMC', 5000, null)], speeds(), TODAY)
    expect(m!.rows).toEqual([])
    expect(m!.onPaceCount).toBe(1)
  })

  it('returns null without pay-speed data', () => {
    expect(buildMoneyWaiting([invRow('rmc', 'RMC', 5000, '2026-03-15')], null, TODAY)).toBeNull()
  })
})

describe('openBillsForCustomers', () => {
  it('lists bills for every customer with open money, tones vs their own baseline', () => {
    const map = openBillsForCustomers(
      [
        invRow('rmc', 'RMC', 13700, '2026-03-15', 'Ph 2 rough'),
        invRow('rmc', 'RMC', 2750, '2026-08-20', 'Fresh bill'),
        invRow('ingram', 'Johnny Ingram', 4120, '2026-08-24', 'Repipe'),
      ],
      speeds(),
      TODAY,
    )
    expect(map.get('rmc')!.map((b) => [b.jobName, b.tone])).toEqual([
      ['Ph 2 rough', 'late'],
      ['Fresh bill', 'ok'],
    ])
    // Ingram's 2-day-old bill is under his 8d baseline — listed, toned ok.
    expect(map.get('ingram')!.map((b) => [b.jobName, b.waitDays, b.tone])).toEqual([['Repipe', 2, 'ok']])
  })
})
