import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5013',
  date: '2026-10-09',
  title: 'People → Review: a sub sheet with several names counts an equal share for each',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A sub sheet with four names on it used to count in full on each person’s review. Now each name counts a quarter, as Team Summary already did.',
    'The rest of the sheet shows as sub labor by others on that person’s line.',
    'The window that lists who put labor on a job still shows the sheet as one row under all its names.',
  ],
}

export default note
