import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2035',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Payment follow-up: call mode sees every late bill',
  highlights: [
    'Call mode now loads every board scope, so bills on part-billed Working jobs join the queue — live verification caught $42,854 across two customers that only the card was counting.',
    "The queue also ignores the board's hidden groups and any live search — money can't fall out of the follow-up loop because a view was decluttered.",
    'The card and call mode now always agree on who owes a call and for how much.',
  ],
}

export default note
