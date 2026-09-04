import { describe, expect, it } from 'vitest'
import { bidBoardJobLinkLabel, canSeeBidBoardJobLinks, indexJobsByBidId } from './bidBoardJobLinks'

describe('bidBoardJobLinks (v2.2741)', () => {
  it('only roles that can open Jobs see the chip', () => {
    for (const r of ['dev', 'master_technician', 'assistant', 'controller']) expect(canSeeBidBoardJobLinks(r)).toBe(true)
    for (const r of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helper', null, undefined, '']) expect(canSeeBidBoardJobLinks(r)).toBe(false)
  })
  it('labels read J####', () => {
    expect(bidBoardJobLinkLabel('1234')).toBe('J1234')
    expect(bidBoardJobLinkLabel('J1234')).toBe('J1234')
    expect(bidBoardJobLinkLabel(' j 77 ')).toBe('J77')
    expect(bidBoardJobLinkLabel('')).toBe('Job')
    expect(bidBoardJobLinkLabel(null)).toBe('Job')
  })
  it('indexes one job per bid, newest wins', () => {
    const m = indexJobsByBidId([
      { id: 'old', hcp_number: '100', bid_id: 'b1', created_at: '2026-01-01' },
      { id: 'new', hcp_number: '200', bid_id: 'b1', created_at: '2026-02-01' },
      { id: 'x', hcp_number: '300', bid_id: null },
      { id: 'y', hcp_number: null, bid_id: 'b2' },
    ])
    expect(m.get('b1')).toEqual({ jobId: 'new', hcpNumber: '200' })
    expect(m.get('b2')).toEqual({ jobId: 'y', hcpNumber: '' })
    expect(m.size).toBe(2)
  })
})
