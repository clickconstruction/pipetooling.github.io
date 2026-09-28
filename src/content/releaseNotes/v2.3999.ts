import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3999',
  date: '2026-09-28',
  title: 'Bids: what the page loads is its own piece',
  kind: 'fix',
  highlights: [
    'The part of the Bids page that loads your role, the trades, the bids and the customers moved into its own piece, with tests for what each load asks for. Nothing you see changed.',
  ],
}

export default note
