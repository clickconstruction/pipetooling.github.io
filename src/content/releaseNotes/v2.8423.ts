import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8423',
  date: '2026-11-23',
  title: 'Bills sent: a bill with nothing left out reads Paid',
  kind: 'fix',
  highlights: [
    'A bill whose payments cover it now reads Paid on Bills sent. Before, one could read Part paid with $0.00 out and count among the bills not paid.',
    'On By day paid, a payment that covers its bill no longer says it is part of the bill.',
  ],
}

export default note
