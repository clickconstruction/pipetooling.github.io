import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3936',
  date: '2026-09-27',
  title: 'Workflow: the Superintendents line is its own piece',
  kind: 'fix',
  highlights: [
    'The Superintendents line under a project’s title — the chips, the × on each, the list to add another — moved out of the Workflow page into its own small component, with tests for what it shows and for every read and write behind it.',
    'Nothing on screen changes: the chips are there when the page first appears, as before.',
  ],
}

export default note
