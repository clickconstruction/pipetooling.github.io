import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3939',
  date: '2026-09-27',
  title: 'New Job: what an import decides has tests',
  kind: 'fix',
  highlights: [
    'Importing a bid into a new job decides which GC the job is for and what price it opens at, and asks “Start the job at $X?”. Those decisions, and how an estimate’s lines and customer fill the form, are now tested rules of their own.',
    'Nothing on screen changes.',
  ],
}

export default note
