import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6092',
  date: '2026-10-29',
  title: 'Phone first: clock out in one press',
  kind: 'feature',
  highlights: [
    'The clock-out review is now called Clock out, and its note is filled from the reports you filed today: one line a report, the job, how far it got and what got done. Edit it if you like, then press Complete clock out.',
    'With no report that day the review asks for the note as before.',
    'The Job Mode card refreshes right after its own clock in, job change or clock out, instead of waiting for a live update.',
    'The Job Report button leaves Job Mode on a tablet and a computer too. It opened nothing there; Leave Report on the card is the same door.',
  ],
  roles: ['subcontractor', 'helpers', 'superintendent', 'master_technician', 'primary'],
}

export default note
