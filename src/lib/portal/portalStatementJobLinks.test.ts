import { describe, it, expect } from 'vitest'
import { buildStatementJobLinks } from './portalStatementJobLinks'

const jobs = [
  { id: 'j746', hcp_number: '746', click_number: null },
  { id: 'j964', hcp_number: '964', click_number: null },
  { id: 'jC12', hcp_number: '', click_number: 'C12' },
]

describe('buildStatementJobLinks', () => {
  it('maps statement rows to jobs in order, keeping trade tags', () => {
    const links = buildStatementJobLinks(
      [
        { jobNumber: '746', serviceTag: 'plum', amount: 855 },
        { jobNumber: '964', serviceTag: 'plum', amount: 3013.3 },
      ],
      jobs,
    )
    expect(links).toEqual([
      { jobId: 'j746', jobNumber: '746', serviceTag: 'plum', amount: 855 },
      { jobId: 'j964', jobNumber: '964', serviceTag: 'plum', amount: 3013.3 },
    ])
  })

  it('collapses multiple bills on one job into one chip with summed amount', () => {
    const links = buildStatementJobLinks(
      [
        { jobNumber: '746', amount: 100.1 },
        { jobNumber: '746', amount: 0.2 },
      ],
      jobs,
    )
    expect(links).toEqual([{ jobId: 'j746', jobNumber: '746', serviceTag: null, amount: 100.3 }])
  })

  it('skips numberless rows and numbers with no matching office job', () => {
    const links = buildStatementJobLinks(
      [
        { jobNumber: '', amount: 5 },
        { jobNumber: '999', amount: 6 },
        { jobNumber: 'C12', amount: 7 },
      ],
      jobs,
    )
    expect(links).toEqual([{ jobId: 'jC12', jobNumber: 'C12', serviceTag: null, amount: 7 }])
  })
})
