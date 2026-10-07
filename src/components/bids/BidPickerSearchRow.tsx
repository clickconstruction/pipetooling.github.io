/**
 * The row above the bid picker on the nine bid workflow tabs — Counts, Takeoffs, Labor,
 * Pricing, Cover Letter, Submittals, RFI, Change Order, Lien Release: the search box, the
 * sort-view switcher, "Only my bids" — with "Hide robots" just below it while "Only my bids" is
 * off — and the *Marked* switch (v2.4287). Each tab carried its own copy of these eleven lines.
 *
 * The tab keeps the query (its filter reads it) and the page keeps "only my bids" (one shared
 * choice); the sort view is the module store behind `BidPickerSortToggle`, "Hide robots" the
 * one behind `HideRobotsToggle`, and the marks and the Marked switch the one behind `bidMarksStore`.
 *
 * `searchesBidNumber`: the six estimating tabs match a bid number too and say so; the three
 * paper tabs (RFI, Change Order, Lien Release) search the project and the GC only, and their
 * box holds a 200px minimum so it wraps under the toggles instead of collapsing.
 */
import { useLayoutEffect } from 'react'
import { BidPickerSortToggle } from './BidPickerSortToggle'
import { MyBidsToggle } from './MyBidsToggle'
import { HideRobotsToggle, setHideRobotsOffered } from './HideRobotsToggle'
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
  // "Hide robots" is on the page only while "Only my bids" is off; the list hides nothing by it otherwise.
  useLayoutEffect(() => {
    setHideRobotsOffered(!onlyMyBids)
    return () => setHideRobotsOffered(false)
  }, [onlyMyBids])
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'stretch', flex: 'none' }}>
        <MyBidsToggle compact={!onlyMyBids} active={onlyMyBids} onChange={onOnlyMyBidsChange} />
        {onlyMyBids ? null : <HideRobotsToggle />}
      </div>
      <MarkedBidsToggle />
    </div>
  )
}
