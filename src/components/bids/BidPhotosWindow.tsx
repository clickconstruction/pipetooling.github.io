/**
 * The bid's photos in a window of their own (punch list #306, PR 3): `useBidPhotosPanel` in a modal shell. The Bid
 * Board opens the photos inside the bid's Files window instead (`BidFilesModal`, PR 5); this window stays for a
 * door that wants the photos alone.
 */
import ResponsiveModalShell from '../ResponsiveModalShell'
import type { BidPhotosWindowIo } from '../../lib/bids/bidPhotosIo'
import { useBidPhotosPanel, type BidPhotosWindowBid } from './useBidPhotosPanel'

export function BidPhotosWindow(props: { bid: BidPhotosWindowBid; onClose: () => void; onChanged?: () => void; io?: BidPhotosWindowIo }) {
  const panel = useBidPhotosPanel(props)
  return (
    <ResponsiveModalShell title={panel.title} onRequestClose={panel.close} footer={panel.footer} maxWidthDesktop={760} fullScreenKey="bid-photos">
      {panel.body}
    </ResponsiveModalShell>
  )
}

export default BidPhotosWindow
