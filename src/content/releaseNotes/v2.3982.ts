import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3982',
  date: '2026-09-27',
  title: 'Bids: Last contact no longer opens Followup for roles that cannot open it',
  kind: 'fix',
  highlights: [
    'On the Bid Board, a primary or a superintendent now reads the Last contact date as plain text. Before, clicking it opened Followup → By status, a tab those roles are turned away from everywhere else.',
    'On Followup → By builder, a superintendent no longer sees the magnifying glass that opened the same tab.',
    'Office roles see no change: the date and the glass still open By status on that bid.',
  ],
}

export default note
