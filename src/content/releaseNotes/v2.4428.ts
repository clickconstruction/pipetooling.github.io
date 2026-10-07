import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4428',
  date: '2026-10-02',
  title: 'Two more windows fit the screen: They approved it, and Email reports',
  kind: 'fix',
  highlights: [
    'On a short screen, the "They approved" window on Bids → Submittals could open taller than the screen. Its top was cut off and could not be scrolled to.',
    'That window now fits the screen. The title and the Approve button stay in view, and the fields scroll between them.',
    'Email reports, on Jobs → Reports and the Dashboard, is held the same way. Its title and Close stay in view while the list scrolls.',
  ],
}

export default note
