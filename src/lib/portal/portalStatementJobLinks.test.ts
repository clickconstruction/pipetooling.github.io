import { describe, it, expect } from 'vitest'
import { buildStatementBillRows } from './portalStatementJobLinks'

const jobs = [
  { id: 'j898', hcp_number: '898', click_number: null },
  { id: 'j789', hcp_number: '789', click_number: null },
  { id: 'jC12', hcp_number: '', click_number: 'C12' },
]

describe('buildStatementBillRows', () => {
  it('mirrors the statement: one row per bill, order and duplicates preserved', () => {
    const rows = buildStatementBillRows(
      [
        { jobNumber: '898', serviceTag: 'plum', amount: 1200, billedOn: '2026-07-31', payUrl: 'https://pay/898a' },
        { jobNumber: '789', serviceTag: 'plum', amount: 462, billedOn: '2026-07-31', payUrl: 'https://pay/789' },
        { jobNumber: '898', serviceTag: 'plum', amount: 3600, billedOn: '2026-07-06', payUrl: null },
      ],
      jobs,
    )
    expect(rows.map((r) => [r.jobNumber, r.amount, r.payUrl])).toEqual([
      ['898', 1200, 'https://pay/898a'],
      ['789', 462, 'https://pay/789'],
      ['898', 3600, null],
    ])
    expect(rows[0]?.jobId).toBe('j898')
    expect(rows[2]?.jobId).toBe('j898')
    expect(rows[0]?.billedOn).toBe('2026-07-31')
  })

  it('skips numberless rows and numbers with no matching office job', () => {
    const rows = buildStatementBillRows(
      [
        { jobNumber: '', amount: 5 },
        { jobNumber: '999', amount: 6 },
        { jobNumber: 'C12', amount: 7 },
      ],
      jobs,
    )
    expect(rows).toEqual([
      { jobId: 'jC12', jobNumber: 'C12', serviceTag: null, amount: 7, billedOn: null, payUrl: null },
    ])
  })
})
