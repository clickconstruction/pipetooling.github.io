import { describe, expect, it } from 'vitest'
import { buildBidCopyForText } from './bidCopyForText'

describe('buildBidCopyForText', () => {
  it('builds all three lines when every field is present', () => {
    expect(
      buildBidCopyForText({
        project_name: 'ALSATIAN',
        address: 'CASTROVILLE TX',
        bid_due_date: '2026-08-27',
      }),
    ).toBe('ALSATIAN\nCASTROVILLE TX\nBid due: 8/27/2026')
  })

  it('skips missing or blank fields', () => {
    expect(buildBidCopyForText({ project_name: 'ALSATIAN', address: '  ', bid_due_date: null })).toBe('ALSATIAN')
    expect(buildBidCopyForText({ project_name: null, address: 'CASTROVILLE TX' })).toBe('CASTROVILLE TX')
  })

  it('returns an empty string when nothing is available', () => {
    expect(buildBidCopyForText({})).toBe('')
    expect(buildBidCopyForText({ project_name: '', address: null, bid_due_date: '   ' })).toBe('')
  })

  it('trims whitespace and formats timestamps without timezone shift', () => {
    expect(
      buildBidCopyForText({
        project_name: '  ALSATIAN  ',
        bid_due_date: '2026-01-05T00:00:00',
      }),
    ).toBe('ALSATIAN\nBid due: 1/5/2026')
  })

  it('passes through a due date it cannot parse', () => {
    expect(buildBidCopyForText({ bid_due_date: 'late August' })).toBe('Bid due: late August')
  })
})
