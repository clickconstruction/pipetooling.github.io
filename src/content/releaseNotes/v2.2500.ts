import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2500',
  date: '2026-08-30',
  title: 'Robot Board — twin bids get their own scope of the Bid Board',
  kind: 'feature',
  highlights: [
    'Bids assigned to (or created by) a digital twin now live on a 🤖 Robot Board tab beside the Bid Board — same sections, same cards, same edit flows.',
    'The human Bid Board and its section counts no longer include robot bids, so your numbers stay yours.',
    'The tab shows the live robot-bid count and only appears when there is robot work; deep links land on whichever board holds the bid.',
  ],
}

export default note
