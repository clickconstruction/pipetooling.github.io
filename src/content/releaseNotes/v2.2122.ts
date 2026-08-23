import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2122',
  date: '2026-08-23',
  title: '"Version" now means one thing: a bid the customer can receive',
  kind: 'fix',
  highlights: [
    'Takeoff and Labor tabs say "book", not "version": "— Select a book —", "Labor book", "Add book", "Edit book name". Pricing says "scenario": "Delete price scenario", "Copy prices from another scenario".',
    'The Workbench door now asks "What do you want?" — Another price point ("For you to compare. The customer only ever sees the ★.") or Another bid to send ("The customer sees it — its own section or letter.").',
    'The structure bar gains a third cell: Labor & cost — shared by the whole package. Switching bids changes revenue, not cost.',
    'A bid with no versions reads "One bid" at the top instead of a package of one named "Current".',
  ],
}

export default note
