import type { CSSProperties } from 'react'
import type { Bid } from '../../types/bids'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { bidDisplayName, bidWorkflowTabHeading } from '../../lib/bids/bidFormatting'

type BidWorkflowTabTitleWithPreviewProps = {
  bid: Bid
  previewEnabled: boolean
  onOpenPreview: () => void
  h2Style?: CSSProperties
}

export function BidWorkflowTabTitleWithPreview({ bid, previewEnabled, onOpenPreview, h2Style }: BidWorkflowTabTitleWithPreviewProps) {
  const prefixMap = useLedgerPrefixMap()
  const mergedH2Style: CSSProperties = h2Style ?? { margin: 0 }
  const name = bidDisplayName(bid).trim()
  const label = name || 'Bid'
  const num = bid.bid_number?.trim()
  if (!previewEnabled || !num) {
    return <h2 style={mergedH2Style}>{bidWorkflowTabHeading(bid, prefixMap)}</h2>
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
    </h2>
  )
}
