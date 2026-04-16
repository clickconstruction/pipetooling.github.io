/** Documents page primary tab (`?tab=`). Legacy `?tab=ledger` + `?ledger=` supported. */

export type DocumentsPageTab = 'estimates' | 'bid-proposals' | 'jobs' | 'upload'

export function parseDocumentsPageTabFromSearch(search: string): DocumentsPageTab {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const t = p.get('tab')
  const l = p.get('ledger')

  if (t === 'upload') return 'upload'
  if (t === 'jobs') return 'jobs'
  if (t === 'bid-proposals') return 'bid-proposals'
  if (t === 'estimates') return 'estimates'

  if (t === 'ledger' || t === null || t === '') {
    if (l === 'bid-proposals') return 'bid-proposals'
    return 'estimates'
  }

  return 'estimates'
}
