import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4961',
  date: '2026-10-08',
  title: 'GC mode: the schedule’s presses can save',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every press on the GC mode schedule can now save to the database: a move of any kind with its reason, Undo and Redo, a first draft, a split, the job’s own work, an inspection, a new baseline, a walk, a what-if copy, the marks, the waits, the dates to meet, the templates and the rough.',
    'Each press sends the answer the screen worked out and reads the job back. A press made on a schedule someone changed since is refused, with what changed.',
    'Nothing shows it yet. The Schedule tab comes next, for devs first.',
  ],
}

export default note
