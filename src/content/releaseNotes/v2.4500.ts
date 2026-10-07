import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4500',
  date: '2026-10-04',
  title: 'Submittals: the rows table is its own piece',
  kind: 'fix',
  highlights: [
    'The second step of splitting the Submittals tab. The table of rows moved out into its own file, unchanged, with a test of its own.',
    'Nothing on screen changes.',
  ],
}

export default note
