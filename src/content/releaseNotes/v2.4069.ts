import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4069',
  date: '2026-09-28',
  title: 'The autosave behind Edit Job, Edit Bid and estimates has tests of its own',
  kind: 'fix',
  highlights: [
    'The piece that saves your changes a moment after you type — on Edit Job, Edit Bid and estimate drafts — now has its own tests for when it saves, when it waits, and what happens on close. Nothing you see changed.',
  ],
}

export default note
