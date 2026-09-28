import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4032',
  date: '2026-09-28',
  title: 'My Time day editor: changing only the notes keeps approved hours approved',
  kind: 'fix',
  highlights: [
    'Editing only the notes of a block made of several clock sessions on the same job used to rebuild those sessions on Save, which took their approved hours back out of payroll until someone approved them again.',
    'A notes-only edit now just saves the notes: the sessions, their times and their approval stay as they were.',
    'The “already approved” warning no longer appears for a notes-only edit like that.',
  ],
}

export default note
