import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3973',
  date: '2026-09-27',
  title: 'Edit Job: autosave is its own piece',
  kind: 'fix',
  highlights: [
    'The part of Edit Job that saves as you type — the money, the job’s details, the materials and the crew — lived inside the form. It is now one piece of its own, with tests that run the clock: an edit saves after its wait and not before, a missing required field holds the save, and a failed save tries again on the next edit.',
    'Nothing on screen changes, and nothing is saved differently.',
  ],
}

export default note
