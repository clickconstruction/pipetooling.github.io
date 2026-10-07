import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4752',
  date: '2026-10-07',
  title: 'Legal portal: the Lien grid says what its switch and its money column mean',
  kind: 'fix',
  highlights: [
    'The grid’s switch reads Due in 30 days and Upcoming, in place of Something due and All.',
    'The money column is headed Amount due, with For work in on the line under it, so the total and the months each read under their own words.',
  ],
}

export default note
