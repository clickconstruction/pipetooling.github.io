import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6125',
  date: '2026-10-30',
  title: 'Quickfill: Unpriced fixtures reads the tally again',
  kind: 'fix',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Since October 27 the Unpriced fixtures station could not read the tally on any load. It fails quietly, so it showed a zero and no banner even when fixtures were waiting for a price.',
    'It reads again. The count of jobs with unpriced fixtures, the age of the oldest one and Price fixtures in Jobs Parts are back when there is something to price.',
  ],
}

export default note
