import { describe, expect, it } from 'vitest'
import { formatBidLedgerDocTitle } from '../ledgerDisplayPrefixes'
import { formatJobFormBidLinkTitle } from './jobFormBidLinkTitle'

describe('formatJobFormBidLinkTitle', () => {
  it('returns empty string for a null summary', () => {
    expect(formatJobFormBidLinkTitle({}, null)).toBe('')
  })

  it('returns the bare project name when the bid has no number', () => {
    expect(formatJobFormBidLinkTitle({}, { project_name: 'Riverside Lofts', bid_number: null })).toBe('Riverside Lofts')
    expect(formatJobFormBidLinkTitle({}, { project_name: 'Riverside Lofts', bid_number: '  ' })).toBe('Riverside Lofts')
  })

  it('falls back to Untitled when the name is blank', () => {
    expect(formatJobFormBidLinkTitle({}, { project_name: '  ', bid_number: null })).toBe('Untitled')
    expect(formatJobFormBidLinkTitle({}, { project_name: null, bid_number: null })).toBe('Untitled')
  })

  it('delegates numbered bids to formatBidLedgerDocTitle (trimmed number, null-safe service type)', () => {
    const summary = { project_name: ' Riverside Lofts ', bid_number: ' 42 ', service_type_id: undefined }
    expect(formatJobFormBidLinkTitle({}, summary)).toBe(formatBidLedgerDocTitle({}, null, '42', 'Riverside Lofts'))
  })
})
