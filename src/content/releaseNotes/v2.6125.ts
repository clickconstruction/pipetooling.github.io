import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6125',
  date: '2026-10-30',
  title: 'Quickfill: Unpriced fixtures reads the tally again',
  kind: 'fix',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Since October 27 the Unpriced fixtures station could not read the tally on any load. It fails quietly, so it showed nothing at all.',
    'No fixture was waiting for a price in that time, so nothing was missed.',
    'It reads again. A fixture tallied with no price now shows up there with the count of jobs, the age of the oldest one and Price fixtures in Jobs Parts.',
  ],
}

export default note
