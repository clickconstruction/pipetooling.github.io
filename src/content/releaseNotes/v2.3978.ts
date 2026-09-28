import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3978',
  date: '2026-09-27',
  title: 'Bids: the page smoke follows a link to a bid',
  kind: 'fix',
  highlights: [
    'The Bids page test now also follows links that point at one bid — to the board, to Followup, to each bid tab, and to the bid’s window — and checks each lands where it should. Nothing you see changed.',
  ],
}

export default note
