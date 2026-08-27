import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2394',
  date: '2026-08-27',
  title: 'Stuck pages un-stick themselves',
  kind: 'fix',
  highlights: [
    'Twice on the Bids and Followup pages the page refused to scroll until a refresh — the freeze that holds the page behind an open window could get left on after the window closed.',
    'Now a held freeze re-checks itself every few seconds, and the moment you try to scroll (wheel, touch, Page Down) it verifies a window is really open — if not, it lets go right then.',
  ],
}

export default note
