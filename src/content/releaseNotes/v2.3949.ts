import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3949',
  date: '2026-09-27',
  title: 'New Job: importing a bid or an estimate is its own piece',
  kind: 'fix',
  highlights: [
    'Filling a new job in from a bid or an estimate — the questions it asks, the GC picker, and what it records on the bid — lived inside the job form. It is now one piece of its own, with tests for each path.',
    'Nothing on screen changes.',
  ],
}

export default note
