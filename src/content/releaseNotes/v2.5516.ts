import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5516',
  date: '2026-10-14',
  title: 'Messages: two console warnings on a thread, quiet',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Opening a thread no longer logs a duplicate key warning for the person.',
    'The job window’s Note · Text · Email pills no longer log a style warning when the kind changes.',
  ],
}

export default note
