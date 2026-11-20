import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8014',
  date: '2026-11-19',
  title: 'Contracts and clauses: the ground for a paper built from settings',
  kind: 'feature',
  highlights: [
    'A contract paper can now carry a settings list in the database. A clause can be tied to one choice of one setting.',
    'The database puts such a paper together for a job’s picks, and says in words when it cannot.',
    'A paper’s revision can be marked as read by an attorney. A later change makes it unread again.',
    'Nothing changes on any screen yet, and no paper has a settings list. The screens come next.',
  ],
}

export default note
