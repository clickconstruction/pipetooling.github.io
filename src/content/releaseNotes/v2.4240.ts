import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4240',
  date: '2026-09-30',
  title: 'Submittals: enter an approval the GC gave outside the app, all at once and on the day they gave it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'They approved all of it… records one approval for every row that has no call yet. You say who approved it and on what day. A row that already has a call keeps it, and a row with no product is left out.',
    'The same door sits over the procurement log as Enter their approval…, where rows read Not shared or Awaiting review. It works on a draft, for a submittal the GC accepted before it was shared here.',
    'A call you enter on one row now has a date box. Set the day they made the call and the row, and the log’s Released date, read that day.',
    'Nothing else changes: each row still reads entered by you, and Edit then clear it takes one back.',
  ],
}

export default note
