import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4347',
  date: '2026-10-01',
  title: 'Windows wait for you to let go before closing',
  kind: 'fix',
  highlights: [
    'About ninety windows closed the moment you pressed outside them, before you let go. Now they close only when you press and let go outside them, like the rest of the app.',
    'Pressing outside and dragging back in leaves the window open. So does starting a text selection just outside a box.',
    'This covers the “Are you sure?” questions, the Person desk, the My Time questions, and windows on Bids, Banking, Checklist and People.',
  ],
}

export default note
