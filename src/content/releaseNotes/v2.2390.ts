import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2390',
  date: '2026-08-27',
  title: 'Bid-name clicks open the new Bid window',
  kind: 'feature',
  highlights: [
    'Clicking a bid\'s name or number anywhere on the Bids page — the workflow-tab titles, board links, the weekly-sent drill-down — now opens the tabbed Bid window on its Bid tab, one flip away from Edit.',
    'Before, those clicks opened the old standalone preview, whose Edit bid button then bounced you into the window — the exact two-modal shuffle the window was built to end.',
    'Off the Bids page (Dashboard, global search, customer profiles) the standalone preview stays, exactly as before.',
  ],
}

export default note
