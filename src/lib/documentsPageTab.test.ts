import { describe, expect, it } from 'vitest'
import { parseDocumentsPageTabFromSearch } from './documentsPageTab'

describe('parseDocumentsPageTabFromSearch', () => {
  it('reads each tab by name, the Sent tab among them', () => {
    for (const tab of ['company', 'search', 'estimates', 'bid-proposals', 'jobs', 'supply-invoices', 'sent', 'upload'] as const) {
      expect(parseDocumentsPageTabFromSearch(`?tab=${tab}`)).toBe(tab)
    }
  })

  it('opens on Estimates with no tab or one it does not know, and still reads the old ledger links', () => {
    expect(parseDocumentsPageTabFromSearch('')).toBe('estimates')
    expect(parseDocumentsPageTabFromSearch('?tab=nope')).toBe('estimates')
    expect(parseDocumentsPageTabFromSearch('?tab=ledger&ledger=bid-proposals')).toBe('bid-proposals')
  })
})
