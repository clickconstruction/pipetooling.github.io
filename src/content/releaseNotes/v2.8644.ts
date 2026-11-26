import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8644',
  date: '2026-11-26',
  title: 'Lien window: deleting a test notice record takes its Activity line too',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Deleting a voided by-hand notice record of a test job left its line on the job’s Activity for good. The delete now takes the record and its line together.',
    'The window that asks first, and the note after it, now say the line goes with the record.',
    'On a test job the developer also reads Activity lines of deleted notice records, with Clear…, for the lines that records deleted earlier left behind.',
    'Nothing changes for the office. A real job’s records and its Activity are never touched.',
  ],
}

export default note
