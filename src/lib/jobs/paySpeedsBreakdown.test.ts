import { describe, expect, it } from 'vitest'
import { buildPaySpeedsBreakdown, bucketPaySpeeds } from './paySpeedsBreakdown'
import type { PaySpeedData } from './billedExpectedPay'
import type { StageRow } from '../jobsStagesBoard'
import type { JobWithDetails } from '../../types/jobWithDetails'

const speeds: PaySpeedData = {
  company: { medianDays: 16, samples: 40 },
  customers: {
    knight: { medianDays: 25, samples: 6 },
    harper: { medianDays: 44, samples: 3 },
    holub: { medianDays: 7, samples: 4 },
    weiss: { medianDays: 30, samples: 2 }, // thin — under the 3-sample floor
  },
  segments: {
    residential: { medianDays: 7, samples: 8 },
    commercial: { medianDays: 25, samples: 32 },
  },
  customerTypes: { knight: 'commercial', harper: 'commercial', holub: 'residential', weiss: 'commercial' },
}

function invRow(customerId: string | null, name: string, amount: number, invoiceId = `inv-${name}-${amount}`): StageRow {
  const job = {
    id: `j-${customerId ?? 'none'}`,
    customer_id: customerId,
    customer_name: name,
    payments: [],
    invoices: [],
  } as unknown as JobWithDetails
  return {
    kind: 'invoice',
    job,
    inv: { id: invoiceId, job_id: job.id, amount, status: 'billed', sequence_order: 1 },
  } as unknown as StageRow
}

describe('buildPaySpeedsBreakdown', () => {
  it('groups open dollars per customer and splits real-median vs thin-history tiers', () => {
    const rows = [
      invRow('knight', 'Knight Contracting', 1200),
      invRow('knight', 'Knight Contracting', 600, 'inv-k2'),
      invRow('harper', 'TF Harper', 2918),
      invRow('holub', 'Michael Holub', 2375),
      invRow('weiss', 'Weiss Services', 1625),
    ]
    const b = buildPaySpeedsBreakdown(rows, speeds)
    expect(b.ranked.map((c) => c.customerId)).toEqual(['harper', 'knight', 'holub'])
    expect(b.ranked[0]).toMatchObject({ medianDays: 44, samples: 3, open: 2918, segment: 'commercial' })
    expect(b.ranked[1]?.open).toBe(1800) // both Knight bills summed
    expect(b.thin).toHaveLength(1)
    expect(b.thin[0]).toMatchObject({ customerId: 'weiss', medianDays: null, samples: 2, open: 1625 })
    expect(b.maxDays).toBe(44)
  })

  it('skips job rows, fully-paid rows, and rows without a customer', () => {
    const paid = invRow('knight', 'Knight Contracting', 500)
    ;(paid as { inv: { amount: number } }).inv.amount = 0
    const rows = [
      { kind: 'job', job: { id: 'jx' } } as unknown as StageRow,
      paid,
      invRow(null, 'No Customer Shell', 900),
    ]
    const b = buildPaySpeedsBreakdown(rows, speeds)
    expect(b.ranked).toHaveLength(0)
    expect(b.thin).toHaveLength(0)
  })

  it('treats every customer as thin history when pay speeds are unavailable', () => {
    const b = buildPaySpeedsBreakdown([invRow('knight', 'Knight Contracting', 1200)], null)
    expect(b.ranked).toHaveLength(0)
    expect(b.thin).toHaveLength(1)
    expect(b.thin[0]).toMatchObject({ medianDays: null, samples: 0 })
  })
})

describe('bucketPaySpeeds', () => {
  it('counts ranked customers into speed buckets by segment', () => {
    const { ranked } = buildPaySpeedsBreakdown(
      [invRow('knight', 'Knight', 100), invRow('harper', 'Harper', 100), invRow('holub', 'Holub', 100)],
      speeds,
    )
    const buckets = bucketPaySpeeds(ranked)
    expect(buckets.find((b) => b.label === '0–7d')?.res.map((c) => c.customerId)).toEqual(['holub'])
    expect(buckets.find((b) => b.label === '22–30d')?.comm.map((c) => c.customerId)).toEqual(['knight'])
    expect(buckets.find((b) => b.label === '31–45d')?.comm.map((c) => c.customerId)).toEqual(['harper'])
  })
})
