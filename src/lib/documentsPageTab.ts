/** Documents page primary tab (`?tab=`). Legacy `?tab=ledger` + `?ledger=` supported. `where-files-go` is the office's Drive tab (punch list #211); `photos` every photo uploaded (punch list #232); `painted-maps` every painted map (punch list #345); `agreements` every agreement on file, the office's (punch list #376: a role without the tab is shown Estimates, which `Documents.tsx` decides). The `upload` placeholder tab is gone; an old `?tab=upload` lands on estimates like any unknown value. */

export type DocumentsPageTab =
  | 'company'
  | 'search'
  | 'estimates'
  | 'bid-proposals'
  | 'jobs'
  | 'supply-invoices'
  | 'sent'
  | 'where-files-go'
  | 'photos'
  | 'painted-maps'
  | 'agreements'

export function parseDocumentsPageTabFromSearch(search: string): DocumentsPageTab {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const t = p.get('tab')
  const l = p.get('ledger')

  if (t === 'company') return 'company'
  if (t === 'search') return 'search'
  if (t === 'supply-invoices') return 'supply-invoices'
  if (t === 'sent') return 'sent'
  if (t === 'where-files-go') return 'where-files-go'
  if (t === 'photos') return 'photos'
  if (t === 'painted-maps') return 'painted-maps'
  if (t === 'agreements') return 'agreements'
  if (t === 'jobs') return 'jobs'
  if (t === 'bid-proposals') return 'bid-proposals'
  if (t === 'estimates') return 'estimates'

  if (t === 'ledger' || t === null || t === '') {
    if (l === 'bid-proposals') return 'bid-proposals'
    return 'estimates'
  }

  return 'estimates'
}

/**
 * The tab the page draws for this reader. Agreements is the office's (punch list #376): a role without it that follows
 * an old link to `?tab=agreements` is shown Estimates, the page's opening tab, and never a blank page.
 */
export function shownDocumentsPageTab(tab: DocumentsPageTab, can: { agreements: boolean }): DocumentsPageTab {
  if (tab === 'agreements' && !can.agreements) return 'estimates'
  return tab
}
