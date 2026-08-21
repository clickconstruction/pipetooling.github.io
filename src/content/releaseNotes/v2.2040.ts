import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2040',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Payment forecast counts every open bill',
  highlights: [
    'The Payment forecast (and the aging chart and "Who owes what" breakdown) now load every board scope before totaling, so bills on part-billed Working jobs are counted — the live board\'s Past expected showed $43,882 when $100,156 was truly past-expected.',
    "These money views also ignore hidden groups, GC/development/account-man filters, and any live search — decluttering the board can't shrink the money totals anymore.",
    'While the board is still loading, the modals say so instead of quietly showing a smaller number.',
  ],
}

export default note
