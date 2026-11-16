import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7475',
  date: '2026-11-16',
  title: 'Sub papers: a payment record for each payment (sub labor train)',
  kind: 'feature',
  highlights: [
    'A payment to a sub now has its own paper, the payment record. It shows who was paid, the day, how it was sent, how much went to each sheet and what stays open after it.',
    'Press Payment record… beside a payment in a sheet’s opened row on Jobs → Subs → Pay. One check that paid several sheets is one record.',
    'After Record payment, a small window says what was recorded and offers the payment record. Nothing is sent to the sub by itself.',
    'No paper carries a number yet. The papers’ numbers arrive together in a later change.',
  ],
}

export default note
