/** Documents page primary tab (`?tab=`). Legacy `?tab=ledger` + `?ledger=` supported. `where-files-go` is the office's Drive tab (punch list #211); `photos` every photo uploaded (punch list #232). */

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
  | 'upload'

export function parseDocumentsPageTabFromSearch(search: string): DocumentsPageTab {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const t = p.get('tab')
  const l = p.get('ledger')

  if (t === 'company') return 'company'
  if (t === 'upload') return 'upload'
  if (t === 'search') return 'search'
  if (t === 'supply-invoices') return 'supply-invoices'
  if (t === 'sent') return 'sent'
  if (t === 'where-files-go') return 'where-files-go'
  if (t === 'photos') return 'photos'
  if (t === 'jobs') return 'jobs'
  if (t === 'bid-proposals') return 'bid-proposals'
  if (t === 'estimates') return 'estimates'

  if (t === 'ledger' || t === null || t === '') {
    if (l === 'bid-proposals') return 'bid-proposals'
    return 'estimates'
  }

  return 'estimates'
}
