import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6703',
  date: '2026-11-08',
  title: 'People → Users: a teammate who is away, with a day back, has a section of their own above Archived (punch list #256, PR 10)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A teammate who left with an Away note on now lists under Away, not Archived. Archived means sealed and banned again.',
    'Each Away row shows the day they left and the day back with the days left, turning amber on the day and after it.',
    'Edit the note… and Bring back… sit on the row, so the note and the return are one press from the list.',
    'Their desk header reads away in place of archived while the note is on.',
  ],
}

export default note
