import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4854',
  date: '2026-10-07',
  title: 'Lien desk: an emptied pile is not a blank list',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A door from the Dashboard or from Do now opens the Notices list on one pile. When you clear that pile, like approving the last notice waiting on you, the list now widens to every pile by itself.',
    'A pile that opens empty says what is no longer there, how many notices sit on the other piles, and offers Show every pile. Before, it read only Nothing in this pile, with no way out.',
  ],
}

export default note
