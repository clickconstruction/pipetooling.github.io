import { describe, expect, it } from 'vitest'
import { applyMinHcpFilter, jobSummaryRowMatchesMinHcp } from './jobSummaryHcpFilter'
import type { JobWithDetails } from '../types/jobWithDetails'

describe('jobSummaryRowMatchesMinHcp', () => {
  it('keeps unnumbered and non-numeric HCPs', () => {
    expect(jobSummaryRowMatchesMinHcp(null, 500)).toBe(true)
    expect(jobSummaryRowMatchesMinHcp('', 500)).toBe(true)
    expect(jobSummaryRowMatchesMinHcp('A12', 500)).toBe(true)
  })

  it('keeps numeric HCP when greater than minExclusive', () => {
    expect(jobSummaryRowMatchesMinHcp('501', 500)).toBe(true)
  })

  it('excludes numeric HCP when at or below minExclusive', () => {
    expect(jobSummaryRowMatchesMinHcp('500', 500)).toBe(false)
    expect(jobSummaryRowMatchesMinHcp('1', 500)).toBe(false)
  })
})

describe('applyMinHcpFilter', () => {
  it('aligns with jobSummaryRowMatchesMinHcp on hcp only', () => {
    const jobs: Pick<JobWithDetails, 'hcp_number' | 'id'>[] = [
      { id: '1', hcp_number: '100' },
      { id: '2', hcp_number: '600' },
    ]
    const filtered = applyMinHcpFilter(jobs as JobWithDetails[], 500)
    expect(filtered.map((j) => j.hcp_number)).toEqual(['600'])
  })
})
