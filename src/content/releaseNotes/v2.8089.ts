import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8089',
  date: '2026-11-20',
  title: 'Sub papers: a box that runs over a page is drawn on both pages',
  kind: 'fix',
  highlights: [
    'A long statement of account lists its payments over two pages. The box round Last payments now closes on the first page and opens again on the next.',
    'Before, the first page had no box and the second page had an empty one drawn below the text.',
    'A payment record with many open statements now runs to a second page. Before, the list ran past the foot of the page.',
    'No figure on any paper changes.',
  ],
}

export default note
