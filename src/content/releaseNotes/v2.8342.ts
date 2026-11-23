import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8342',
  date: '2026-11-23',
  title: 'Dashboard: the lien month card is gone, so the Lien desk is said once',
  kind: 'feature',
  highlights: [
    'The Dashboard showed Lien desk information in two places: at the top beside Needs you, and far below in a card named The lien month. The second card is gone.',
    'What it said is still one press away. The Lien desk card at the top opens the Board, and the days of the lien month are in § Rules on the Lien desk.',
    'The card repeated itself from the 16th of each month, and its counts did not match the ones at the top because they counted different things.',
    'The Dashboard opens a little faster for the office, since three reads the card needed are no longer made.',
  ],
}

export default note
