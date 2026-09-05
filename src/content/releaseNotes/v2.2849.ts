import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2849',
  date: '2026-09-05',
  title: 'Moneyfill: card charges open Banking → User Sort, on the charge',
  kind: 'fix',
  highlights: [
    'In Moneyfill → Card charges not split to jobs, the button on each row is now "Sort in Banking → User Sort" and opens that tab with the charge\'s counterparty already in the search box — press Link… on the row to split it. It used to land at the top of Quickfill, where the sorting section is hidden.',
    'Banking\'s User Sort accepts a search in the link (?q=…), so other pages can open it on a transaction.',
    'The Moneyfill queue reads splits the same way Banking does, so its count and Banking\'s "Not split to jobs" agree for the same charges.',
  ],
}

export default note
