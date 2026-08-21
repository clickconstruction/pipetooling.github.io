import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1950',
  date: '2026-08-21',
  title: 'Renaming roadmap tasks works again',
  kind: 'fix',
  highlights: [
    'Saving a roadmap task\'s title failed silently for everyone due to a database policy loop — fixed, renames from the task card go through now.',
  ],
}

export default note
