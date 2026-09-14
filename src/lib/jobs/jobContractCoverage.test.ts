import { describe, expect, it } from 'vitest'
import {
  abbreviateSignerName,
  buildJobContractCoverage,
  contractCoverageMatchesFilter,
  filterJobsByContractCoverage,
  isContractGap,
  jobContractChipLabel,
  parseStagesContractFilter,
  type JobContractRowLike,
  type SignedEstimateLike,
} from './jobContractCoverage'

function contract(p: Partial<JobContractRowLike>): JobContractRowLike {
  return {
    id: 'c1',
    job_id: 'j1',
    status: 'sent',
    revision: 1,
    recipient_email: 'mpalmer@example.com',
    sent_at: '2026-08-29T15:00:00Z',
    last_sent_at: '2026-08-29T15:00:00Z',
    view_count: 0,
    signed_at: null,
    signer_printed_name: null,
    signer_mode: null,
    voided_at: null,
    ...p,
  }
}

function estimate(p: Partial<SignedEstimateLike>): SignedEstimateLike {
  return {
    id: 'e84',
    job_ledger_id: 'j1',
    bid_id: null,
    doc_kind: 'estimate',
    status: 'customer_accepted',
    acceptor_consented_at: '2026-08-12T18:00:00Z',
    acceptor_printed_name: 'Kimberly Coe',
    estimate_number: 84,
    total_cents: 375912,
    ...p,
  }
}

const NOW = new Date('2026-09-04T12:00:00Z')

describe('buildJobContractCoverage', () => {
  it('reads none when nothing is on file', () => {
    const cov = buildJobContractCoverage([{ id: 'j1', bid_id: null }], [], [])
    expect(cov.get('j1')).toEqual({ kind: 'none' })
  })

  it('a sent contract reads sent with opens and recipient', () => {
    const cov = buildJobContractCoverage([{ id: 'j1', bid_id: null }], [contract({ view_count: 2 })], [])
    expect(cov.get('j1')).toMatchObject({ kind: 'sent', contractId: 'c1', viewCount: 2, recipientEmail: 'mpalmer@example.com' })
    expect(jobContractChipLabel(cov.get('j1'), NOW)).toBe('Contract sent · opened 2× · 5d')
  })

  it('a signed contract beats an accepted estimate', () => {
    const cov = buildJobContractCoverage(
      [{ id: 'j1', bid_id: null }],
      [contract({ status: 'signed', signed_at: '2026-09-02T00:14:00Z', signer_printed_name: 'Michael Palmer', signer_mode: 'draw' })],
      [estimate({})],
    )
    expect(cov.get('j1')).toMatchObject({ kind: 'signed', source: 'contract', signerName: 'Michael Palmer' })
    expect(jobContractChipLabel(cov.get('j1'), NOW)).toBe('✍ Signed Sep 1 · M. Palmer')
  })

  it('a paper upload reads as on file', () => {
    const cov = buildJobContractCoverage(
      [{ id: 'j1', bid_id: null }],
      [contract({ status: 'signed', signed_at: '2026-07-30T12:00:00Z', signer_mode: 'paper' })],
      [],
    )
    expect(cov.get('j1')).toMatchObject({ kind: 'signed', source: 'paper' })
    expect(jobContractChipLabel(cov.get('j1'), NOW)).toBe('✍ On file · paper · Jul 30')
  })

  it('an e-signed accepted estimate counts; one without a consent stamp does not', () => {
    const signed = buildJobContractCoverage([{ id: 'j1', bid_id: null }], [], [estimate({})])
    expect(signed.get('j1')).toMatchObject({ kind: 'signed', source: 'estimate', estimateNumber: 84, estimateId: 'e84' })
    expect(jobContractChipLabel(signed.get('j1'), NOW)).toBe('✍ Signed · estimate #84')
    const unsigned = buildJobContractCoverage([{ id: 'j1', bid_id: null }], [], [estimate({ acceptor_consented_at: null })])
    expect(unsigned.get('j1')).toEqual({ kind: 'none' })
  })

  it('the owner can switch estimate counting off', () => {
    const cov = buildJobContractCoverage([{ id: 'j1', bid_id: null }], [], [estimate({})], { countAcceptedEstimates: false })
    expect(cov.get('j1')).toEqual({ kind: 'none' })
  })

  it("a signed bid-room proposal on the job's bid counts; change orders never do", () => {
    const jobs = [{ id: 'j1', bid_id: 'b1' }]
    const cov = buildJobContractCoverage(jobs, [], [
      estimate({ job_ledger_id: null, bid_id: 'b1', doc_kind: 'bid_proposal', acceptor_printed_name: 'Dan Knight' }),
    ])
    expect(cov.get('j1')).toMatchObject({ kind: 'signed', source: 'bid_room', signerName: 'Dan Knight' })
    const co = buildJobContractCoverage(jobs, [], [estimate({ doc_kind: 'change_order' })])
    expect(co.get('j1')).toEqual({ kind: 'none' })
  })

  it('voided contracts are ignored; a draft reads draft', () => {
    const cov = buildJobContractCoverage(
      [{ id: 'j1', bid_id: null }],
      [contract({ id: 'old', status: 'sent', voided_at: '2026-09-01T00:00:00Z' }), contract({ id: 'new', status: 'draft' })],
      [],
    )
    expect(cov.get('j1')).toEqual({ kind: 'draft', contractId: 'new' })
  })
})

describe('filters and helpers', () => {
  it('missing matches none and draft; sent and signed match their kinds', () => {
    expect(contractCoverageMatchesFilter({ kind: 'none' }, 'missing')).toBe(true)
    expect(contractCoverageMatchesFilter({ kind: 'draft', contractId: 'c' }, 'missing')).toBe(true)
    expect(contractCoverageMatchesFilter({ kind: 'none' }, 'sent')).toBe(false)
    expect(contractCoverageMatchesFilter(undefined, '')).toBe(true)
    const coverage = new Map([
      ['a', { kind: 'none' } as const],
      ['b', { kind: 'signed', source: 'contract', signedAt: null, signerName: null, contractId: 'c', estimateNumber: null, estimateId: null } as const],
    ])
    expect(filterJobsByContractCoverage([{ id: 'a' }, { id: 'b' }], coverage, 'signed').map((j) => j.id)).toEqual(['b'])
  })

  it('parses the deep-link param and abbreviates names', () => {
    expect(parseStagesContractFilter('missing')).toBe('missing')
    expect(parseStagesContractFilter('bogus')).toBe('')
    expect(abbreviateSignerName('Michael  Palmer')).toBe('M. Palmer')
    expect(abbreviateSignerName('Cher')).toBe('Cher')
    expect(abbreviateSignerName('  ')).toBeNull()
  })
})

describe('Not needed and the floor (Contract sweep PR 0)', () => {
  it('a job the office marked Not needed reads its own state — never a gap, but a signed record still wins', () => {
    const cov = buildJobContractCoverage(
      [
        { id: 'j1', bid_id: null, contract_not_needed_at: '2026-09-13T15:00:00Z', contract_not_needed_reason: 'GC job — their subcontract' },
        { id: 'j2', bid_id: null, contract_not_needed_at: '2026-09-13T15:00:00Z' },
      ],
      [contract({ id: 'c2', job_id: 'j2', status: 'signed', signed_at: '2026-09-02T00:14:00Z', signer_printed_name: 'Michael Palmer', signer_mode: 'draw' })],
      [],
    )
    expect(cov.get('j1')).toEqual({ kind: 'not_needed', at: '2026-09-13T15:00:00Z', reason: 'GC job — their subcontract' })
    expect(jobContractChipLabel(cov.get('j1'), NOW)).toBe('No contract · not needed')
    expect(cov.get('j2')).toMatchObject({ kind: 'signed', source: 'contract' })
    expect(isContractGap(cov.get('j1'), 5000, 0)).toBe(false)
    expect(contractCoverageMatchesFilter(cov.get('j1'), 'missing')).toBe(false)
  })

  it('Not needed beats a sent or drafted contract — the office answered', () => {
    const cov = buildJobContractCoverage([{ id: 'j1', bid_id: null, contract_not_needed_at: '2026-09-13T15:00:00Z' }], [contract({ status: 'sent' })], [])
    expect(cov.get('j1')?.kind).toBe('not_needed')
  })

  it('the floor keeps small jobs out of the gap; no amount stays in', () => {
    const cov = buildJobContractCoverage([{ id: 'small', bid_id: null }, { id: 'big', bid_id: null }, { id: 'unknown', bid_id: null }], [], [])
    const jobs = [
      { id: 'small', revenue: 450 },
      { id: 'big', revenue: 123600 },
      { id: 'unknown', revenue: null },
    ]
    expect(filterJobsByContractCoverage(jobs, cov, 'missing', 250000).map((j) => j.id)).toEqual(['big', 'unknown'])
    expect(filterJobsByContractCoverage(jobs, cov, 'missing').map((j) => j.id)).toEqual(['small', 'big', 'unknown'])
    expect(isContractGap(cov.get('small'), 450, 250000)).toBe(false)
    expect(isContractGap(cov.get('small'), 450, 0)).toBe(true)
  })
})
