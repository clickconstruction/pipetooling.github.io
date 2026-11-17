import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7570',
  date: '2026-11-17',
  title: 'Task notes: the database can now hold a tag for a teammate',
  kind: 'infra',
  highlights: [
    'A task note can now carry a tag for a teammate, kept as its own record. Nothing on screen has changed yet.',
    'Only people who can already open the task can be tagged on it: whoever gave it, whoever has it, and the office.',
    'A tag waits until the tagged person writes a note on that task or says no reply is needed. A tick clears nothing.',
    'The next update adds the names to a task’s note box.',
  ],
}

export default note
