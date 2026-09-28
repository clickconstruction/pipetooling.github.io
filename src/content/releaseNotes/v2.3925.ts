import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3925',
  date: '2026-09-27',
  title: 'Workflow: what a folded stage card says has tests',
  kind: 'fix',
  highlights: [
    'The rules behind the stage list — which cards start folded, which steps “Hide Old Steps” tucks behind its summary row, the day count, item total and word counts on a folded card’s pills, and when a step is empty enough to delete without typing its name — lived inside the Workflow page with no test. They now live in three small modules with thirty.',
    'Nothing on screen changes.',
  ],
}

export default note
