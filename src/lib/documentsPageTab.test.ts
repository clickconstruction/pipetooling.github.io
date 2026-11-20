import { describe, expect, it } from 'vitest'
import { parseDocumentsPageTabFromSearch, shownDocumentsPageTab } from './documentsPageTab'

describe('parseDocumentsPageTabFromSearch', () => {
  it('reads each tab by name, the Sent tab among them', () => {
    for (const tab of ['company', 'search', 'estimates', 'bid-proposals', 'jobs', 'supply-invoices', 'sent', 'where-files-go', 'photos', 'painted-maps', 'agreements', 'builder'] as const) {
      expect(parseDocumentsPageTabFromSearch(`?tab=${tab}`)).toBe(tab)
    }
  })

  it('opens on Estimates with no tab or one it does not know, and still reads the old ledger links', () => {
    expect(parseDocumentsPageTabFromSearch('')).toBe('estimates')
    expect(parseDocumentsPageTabFromSearch('?tab=nope')).toBe('estimates')
    expect(parseDocumentsPageTabFromSearch('?tab=upload')).toBe('estimates')
    expect(parseDocumentsPageTabFromSearch('?tab=ledger&ledger=bid-proposals')).toBe('bid-proposals')
  })

  it('shows Estimates to a reader without the Agreements tab, and every other tab as asked', () => {
    expect(shownDocumentsPageTab('agreements', { agreements: true, builder: false })).toBe('agreements')
    expect(shownDocumentsPageTab('agreements', { agreements: false, builder: false })).toBe('estimates')
    expect(shownDocumentsPageTab('jobs', { agreements: false, builder: false })).toBe('jobs')
    expect(shownDocumentsPageTab('sent', { agreements: true, builder: false })).toBe('sent')
  })

  it('shows the Document builder to a reader with the tab, and Estimates to one without it', () => {
    expect(shownDocumentsPageTab('builder', { agreements: true, builder: true })).toBe('builder')
    expect(shownDocumentsPageTab('builder', { agreements: true, builder: false })).toBe('estimates')
    expect(shownDocumentsPageTab('agreements', { agreements: true, builder: true })).toBe('agreements')
  })
})
