/**
 * The row above the bid picker on the nine bid workflow tabs — Counts, Takeoffs, Labor,
 * Pricing, Cover Letter, Submittals, RFI, Change Order, Lien Release: the search box, the
 * sort-view switcher, "Only my bids" and the *Marked* switch (v2.4287). Each tab carried its
 * own copy of these eleven lines.
 *
 * The tab keeps the query (its filter reads it) and the page keeps "only my bids" (one shared
 * choice); the sort view is the module store behind `BidPickerSortToggle`, and the marks and
 * the Marked switch are the module store behind `bidMarksStore`.
 *
 * `searchesBidNumber`: the six estimating tabs match a bid number too and say so; the three
 * paper tabs (RFI, Change Order, Lien Release) search the project and the GC only, and their
 * box holds a 200px minimum so it wraps under the toggles instead of collapsing.
 */
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { MyBidsToggle } from './MyBidsToggle'
import { MarkedBidsToggle } from './BidMarkControls'

export const BID_PICKER_PLACEHOLDER_WITH_NUMBER = 'Search bids (bid #, project name, or GC/Builder)...'
export const BID_PICKER_PLACEHOLDER = 'Search bids (project name or GC/Builder)...'

export function BidPickerSearchRow({
  query,
  onQueryChange,
  onlyMyBids,
  onOnlyMyBidsChange,
  searchesBidNumber = true,
}: {
  query: string
  onQueryChange: (next: string) => void
  onlyMyBids: boolean
  onOnlyMyBidsChange: (next: boolean) => void
  searchesBidNumber?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
      <input
        type="text"
        placeholder={searchesBidNumber ? BID_PICKER_PLACEHOLDER_WITH_NUMBER : BID_PICKER_PLACEHOLDER}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        style={{ flex: 1, ...(searchesBidNumber ? {} : { minWidth: 200 }), padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, boxSizing: 'border-box' }}
      />
      <BidPickerSortToggle />
      <MyBidsToggle active={onlyMyBids} onChange={onOnlyMyBidsChange} />
      <MarkedBidsToggle />
    </div>
  )
}
