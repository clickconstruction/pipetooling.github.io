import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2776',
  date: '2026-09-04',
  kind: 'feature',
  title: 'Takeoffs: Fill from book now works on Combined takeoffs',
  highlights: [
    'The takeoff book\'s button used to refuse Combined takeoffs, which is nearly every bid. It now fills every fixture the book recognizes that has no part lines yet, expanding each assembly into priced part lines.',
    'Matching ignores case and plan tags, so an entry for "wc" fills WC-12 and Wc 3 alike. The button says how many fixtures it will fill before you click, and fixtures that already have lines are never touched.',
    'By Stage bids keep the old behavior under the old label.',
  ],
}

export default note
