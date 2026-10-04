import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4505',
  date: '2026-10-04',
  title: 'Submittals: one way to build Rev 1',
  kind: 'fix',
  highlights: [
    'Building Rev 1 on the Submittals tab and building it from the question on a won job now run the same code. Before, each had its own copy, and a change to one could miss the other.',
    'Nothing on screen changes.',
  ],
}

export default note
