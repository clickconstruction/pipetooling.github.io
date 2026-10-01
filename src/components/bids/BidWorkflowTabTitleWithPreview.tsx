import type { CSSProperties } from 'react'
import type { Bid } from '../../types/bids'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { bidDisplayName, bidWorkflowTabHeading } from '../../lib/bids/bidFormatting'
import { BidMarkButton } from './BidMarkControls'

type BidWorkflowTabTitleWithPreviewProps = {
  bid: Bid
  previewEnabled: boolean
  onOpenPreview: () => void
  h2Style?: CSSProperties
}

/**
 * The open bid's title on every workflow tab. After the name sits the bid's Mark button
 * (v2.4287): *Mark* / *Marked · today*, so a bid can be marked for later without closing
 * it and finding its row again.
 */
export function BidWorkflowTabTitleWithPreview({ bid, previewEnabled, onOpenPreview, h2Style }: BidWorkflowTabTitleWithPreviewProps) {
  const prefixMap = useLedgerPrefixMap()
  const mergedH2Style: CSSProperties = h2Style ?? { margin: 0 }
  const name = bidDisplayName(bid).trim()
  const label = name || 'Bid'
  const num = bid.bid_number?.trim()
  const mark = (
    <>
      {' '}
      <BidMarkButton bidId={bid.id} />
    </>
  )
  if (!previewEnabled || !num) {
    return (
      <h2 style={mergedH2Style}>
        {bidWorkflowTabHeading(bid, prefixMap)}
        {mark}
      </h2>
    )
  }
  const numLabel = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num)
  const previewA11y = `Preview bid ${numLabel}`
  return (
    <h2 style={mergedH2Style}>
      <button
        type="button"
        onClick={onOpenPreview}
        title={previewA11y}
        aria-label={previewA11y}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          margin: 0,
          font: 'inherit',
          color: 'var(--text-blue-500)',
          cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        {numLabel}
      </button>
      {' '}
      {label}
      {mark}
    </h2>
  )
}
