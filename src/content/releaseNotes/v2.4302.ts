import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4302',
  date: '2026-10-01',
  title: 'Pipeline: the activity box buttons sit under the box',
  kind: 'fix',
  highlights: [
    'On each Pipeline row, + Add and the report button now sit under the activity box instead of on top of the newest note. The note reads to its last word.',
    'The expand arrows moved there too, as See all with the number of notes and reports.',
    'Pressing + Add opens the note bar under the box, so it no longer covers the bottom note. The box keeps its size.',
  ],
}

export default note
