import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3989',
  date: '2026-09-28',
  title: 'Bids: the page’s router is its own piece',
  kind: 'fix',
  highlights: [
    'The part of the Bids page that reads a link and takes you to the right tab, row or bid moved into its own piece, checked by the page test before and after. Nothing you see changed.',
  ],
}

export default note
