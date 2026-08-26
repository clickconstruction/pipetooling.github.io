import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2369',
  date: '2026-08-26',
  title: 'Assign book entries without retyping the row name',
  kind: 'feature',
  highlights: [
    'The Pricing tab\'s "assign…" search now pre-fills without the "ft of" / "feet of" prefix, so takeoff rows start from the part name itself.',
    'Matching is word-by-word: entries containing the most of your words rank first, so a 2-inch water-line row surfaces "feet of water line" instead of "No book entries match."',
    'The Old view\'s book-entry search matches the same way.',
  ],
}

export default note
