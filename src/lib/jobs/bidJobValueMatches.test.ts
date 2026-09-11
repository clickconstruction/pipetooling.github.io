import { describe, expect, it } from 'vitest'
import { pairExactValueMatches, unambiguousMatches } from './bidJobValueMatches'

const bids = [
  { id: 'b375', bid_number: '375', project_name: 'SPACEX BA-02N', outcome: 'won', bid_value: 249_715.66, agreed_value: null },
  { id: 'b66', bid_number: '66', project_name: 'Mission Hill Park', outcome: 'started_or_complete', bid_value: 123_600, agreed_value: null },
  { id: 'b4', bid_number: '4', project_name: 'Dr. Martins', outcome: 'won', bid_value: 30_000, agreed_value: 31_400 },
  { id: 'b4b', bid_number: '4b', project_name: 'Dr. Martins alt', outcome: 'won', bid_value: 31_400, agreed_value: null },
  { id: 'lost', bid_number: '9', project_name: 'Lost one', outcome: 'lost', bid_value: 5_000, agreed_value: null },
]
const jobs = [
  { id: 'j1007', hcp_number: '1007', job_name: 'SPACEX BA-02N Architectural', revenue: '249715.66', status: 'working', bid_id: null },
  { id: 'j523', hcp_number: 'J523', job_name: 'Mission Hill', revenue: 123_600.4, status: 'billed', bid_id: null },
  { id: 'j363', hcp_number: '363', job_name: 'Martins', revenue: 31_400, status: 'paid', bid_id: null },
  { id: 'j5000', hcp_number: '5000', job_name: 'Lost match', revenue: 5_000, status: 'paid', bid_id: null },
  { id: 'jlinked', hcp_number: '1', job_name: 'Already linked', revenue: 249_715.66, status: 'working', bid_id: 'b375' },
]

describe('pairExactValueMatches', () => {
  it('pairs unlinked jobs with won bids within a dollar, flags a job that matches two bids, and skips lost bids and linked jobs', () => {
    const pairs = pairExactValueMatches({ bids, jobs })
    expect(pairs.map((p) => `${p.jobLabel} ↔ ${p.bidLabel}${p.ambiguous ? ' ?' : ''}`)).toEqual([
      'J1007 SPACEX BA-02N Architectural ↔ B375 SPACEX BA-02N',
      'J523 Mission Hill ↔ B66 Mission Hill Park',
      'J363 Martins ↔ B4 Dr. Martins ?',
      'J363 Martins ↔ B4b Dr. Martins alt ?',
    ])
    expect(pairs[0]).toMatchObject({ jobRevenue: 249_715.66, bidValue: 249_715.66, jobStatus: 'working' })
    expect(unambiguousMatches(pairs).map((p) => p.jobId)).toEqual(['j1007', 'j523'])
  })
  it('a bid matching two jobs is ambiguous on both rows', () => {
    const pairs = pairExactValueMatches({ bids: [bids[0]!], jobs: [jobs[0]!, { ...jobs[0]!, id: 'twin', hcp_number: '1008' }] })
    expect(pairs).toHaveLength(2)
    expect(pairs.every((p) => p.ambiguous)).toBe(true)
    expect(unambiguousMatches(pairs)).toEqual([])
  })
})
