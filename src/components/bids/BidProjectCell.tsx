import { BidBoardBidNumberMark } from './BidBoardBidNumberMark'
import { resolveBidLedgerPrefix, type LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

/**
 * Combined "Project" cell for the no-bid-selected bid lists across the workflow tabs:
 * `BP287 | Project Name` (bid-number mark + separator + project name). Falls back to the
 * customer / GC name, then an em dash, when there is no project name; omits the number when absent.
 */
export function BidProjectCell({ bid, ledgerPrefixMap }: { bid: BidWithBuilder; ledgerPrefixMap: LedgerPrefixMap }) {
  const num = bid.bid_number?.trim()
  const name = bidDisplayName(bid) || bid.customers?.name || bid.bids_gc_builders?.name || '—'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' }}>
      {num ? (
        <>
          <BidBoardBidNumberMark bidPrefix={resolveBidLedgerPrefix(bid.service_type_id, ledgerPrefixMap)} bidNumber={num} />
          <span style={{ color: '#9ca3af' }}>|</span>
        </>
      ) : null}
      <span>{name}</span>
    </span>
  )
}
