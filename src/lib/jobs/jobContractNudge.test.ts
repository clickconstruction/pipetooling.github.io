import { describe, expect, it } from 'vitest'
import { contractStageOf, summarizeContractNudge } from './jobContractNudge'
import type { JobContractRowLike } from './jobContractCoverage'

const NOW = new Date('2026-09-10T12:00:00Z')

function contract(p: Partial<JobContractRowLike>): JobContractRowLike {
  return {
    id: 'c',
    job_id: 'j',
    status: 'sent',
    revision: 1,
    recipient_email: null,
    sent_at: '2026-09-01T12:00:00Z',
    last_sent_at: '2026-09-01T12:00:00Z',
    view_count: 0,
    signed_at: null,
    signer_printed_name: null,
    signer_mode: null,
    voided_at: null,
    ...p,
  }
}

describe('summarizeContractNudge', () => {
  it('counts live jobs with nothing on file and sums their revenue; paid jobs are out of scope', () => {
    const s = summarizeContractNudge(
      [
        { id: 'a', bid_id: null, status: 'working', revenue: 5000 },
        { id: 'b', bid_id: null, status: 'waiting', revenue: 1200 },
        { id: 'p', bid_id: null, status: 'paid', revenue: 900 },
      ],
      [],
      [],
      NOW,
    )
    expect(s.missing).toEqual({ count: 2, jobIds: ['a', 'b'], revenueTotal: 6200 })
    expect(s.stale.count).toBe(0)
  })

  it('a sent contract 9 days old is stale; one sent yesterday is not; drafts still count as missing', () => {
    const s = summarizeContractNudge(
      [
        { id: 'a', bid_id: null, status: 'working', revenue: 1 },
        { id: 'b', bid_id: null, status: 'working', revenue: 1 },
        { id: 'd', bid_id: null, status: 'working', revenue: 1 },
      ],
      [
        contract({ id: 'c1', job_id: 'a' }),
        contract({ id: 'c2', job_id: 'b', sent_at: '2026-09-09T12:00:00Z', last_sent_at: '2026-09-09T12:00:00Z' }),
        contract({ id: 'c3', job_id: 'd', status: 'draft', sent_at: null, last_sent_at: null }),
      ],
      [],
      NOW,
    )
    expect(s.stale).toEqual({ count: 1, jobIds: ['a'], oldestDays: 9 })
    expect(s.missing.jobIds).toEqual(['d'])
  })

  it('an e-signed estimate covers the job', () => {
    const s = summarizeContractNudge(
      [{ id: 'a', bid_id: null, status: 'billed', revenue: 100 }],
      [],
      [{ id: 'e1', job_ledger_id: 'a', bid_id: null, doc_kind: 'estimate', status: 'customer_accepted', acceptor_consented_at: '2026-08-01T00:00:00Z', acceptor_printed_name: 'K', estimate_number: 1, total_cents: 1 }],
      NOW,
    )
    expect(s.missing.count).toBe(0)
  })
})

describe('byStage', () => {
  it('splits live jobs per board stage, with billed + collections_at as Collections; Paid is out of scope', () => {
    const s = summarizeContractNudge(
      [
        { id: 'a', bid_id: null, status: 'waiting', revenue: 100 },
        { id: 'b', bid_id: null, status: 'working', revenue: 200 },
        { id: 'c', bid_id: null, status: 'billed', revenue: 300 },
        { id: 'd', bid_id: null, status: 'billed', revenue: 400, collections_at: '2026-09-01T00:00:00Z' },
        { id: 'p', bid_id: null, status: 'paid', revenue: 900 },
      ],
      [contract({ id: 'cb', job_id: 'b', status: 'signed', signed_at: '2026-09-01T00:00:00Z', signer_printed_name: 'X' })],
      [],
      NOW,
    )
    expect(s.liveTotal).toBe(4)
    expect(s.byStage.waiting).toEqual({ total: 1, missing: 1, revenueMissing: 100 })
    expect(s.byStage.working).toEqual({ total: 1, missing: 0, revenueMissing: 0 })
    expect(s.byStage.billed).toEqual({ total: 1, missing: 1, revenueMissing: 300 })
    expect(s.byStage.collections).toEqual({ total: 1, missing: 1, revenueMissing: 400 })
    expect(s.byStage.ready_to_bill).toEqual({ total: 0, missing: 0, revenueMissing: 0 })
    expect(contractStageOf({ status: 'paid', collections_at: null })).toBeNull()
  })
})


describe('the floor and Not needed (Contract sweep PR 0)', () => {
  it('jobs under the floor and jobs marked Not needed leave the gap count, and the card can say how many', () => {
    const s = summarizeContractNudge(
      [
        { id: 'big', bid_id: null, status: 'working', revenue: 123600 },
        { id: 'small', bid_id: null, status: 'working', revenue: 450 },
        { id: 'unknown', bid_id: null, status: 'working', revenue: null },
        { id: 'gc', bid_id: null, status: 'working', revenue: 32600, contract_not_needed_at: '2026-09-13T15:00:00Z', contract_not_needed_reason: 'GC job — their subcontract' },
      ],
      [],
      [],
      NOW,
      { floorCents: 250000 },
    )
    expect(s.missing).toEqual({ count: 2, jobIds: ['big', 'unknown'], revenueTotal: 123600 })
    expect(s.underFloor).toEqual({ count: 1, revenueTotal: 450 })
    expect(s.notNeeded).toEqual({ count: 1 })
    expect(s.floorCents).toBe(250000)
    expect(s.liveTotal).toBe(4)
    expect(s.byStage.working).toEqual({ total: 4, missing: 2, revenueMissing: 123600 })
  })

  it('with no floor every live job without paper counts, as before', () => {
    const s = summarizeContractNudge([{ id: 'small', bid_id: null, status: 'working', revenue: 450 }], [], [], NOW)
    expect(s.missing.count).toBe(1)
    expect(s.underFloor.count).toBe(0)
    expect(s.floorCents).toBe(0)
  })
})
