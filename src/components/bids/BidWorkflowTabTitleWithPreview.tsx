import type { CSSProperties } from 'react'
import type { Bid } from '../../types/bids'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatBidLedgerNumberLabel, resolveBidLedgerPrefix } from '../../lib/ledgerDisplayPrefixes'
import { bidDisplayName, bidWorkflowTabHeading } from '../../lib/bids/bidFormatting'
import { BidMarkRequestStrip, BidMarkSentStatus, BidMarkTitlePair } from './BidMarkControls'
import { BidHistoryDoor } from './BidHistoryDoor'

type BidWorkflowTabTitleWithPreviewProps = {
  bid: Bid
  previewEnabled: boolean
  onOpenPreview: () => void
  h2Style?: CSSProperties
}

/**
 * The open bid's title on every workflow tab. After the name sits one small control of two
 * icons, `[ mark | for someone ]`: the ring marks the bid for later without closing it and
 * finding its row again (v2.4287; filled when marked), the person marks it for a teammate
 * with a note (v2.4297). Then, where a mark you sent stands, and the History door (v2.4948,
 * punch list #73: the bid's changes, read only). When someone marked the bid for
 * you, their note sits under the title on its own line with Done and Not for me — a sibling
 * of the heading, full width, so it wraps under the title in the host's header row.
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
      <BidMarkTitlePair bid={bid} /> <BidMarkSentStatus bidId={bid.id} />
      {/* Bid history (punch list #73, PR 2): what changed on the bid, who changed it, and when. */}
      <BidHistoryDoor bid={{ id: bid.id, label: label + (num ? ` · ${num}` : ''), bidNumber: num || null }} />
    </>
  )
  const strip = <BidMarkRequestStrip bidId={bid.id} />
  if (!previewEnabled || !num) {
    return (
      <>
        <h2 style={mergedH2Style}>
          {bidWorkflowTabHeading(bid, prefixMap)}
          {mark}
        </h2>
        {strip}
      </>
    )
  }
  const numLabel = formatBidLedgerNumberLabel(resolveBidLedgerPrefix(bid.service_type_id, prefixMap), num)
  const previewA11y = `Preview bid ${numLabel}`
  return (
    <>
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
      {strip}
    </>
  )
}
