import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4264',
  date: '2026-09-30',
  title: 'Bid Board: the Bid column reads at a glance — bigger figures, and a comma in the thousands',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Bid column’s figure is drawn at the same size as the estimator’s name beside it, in figures that line up down the column, instead of the small print it was.',
    'A value of four or more thousands carries a comma — 15,813k, 1,240k — wherever the app writes a bid in thousands: the Bid Board, the Followup tab’s bid size and the proposal PDF.',
  ],
}

export default note
