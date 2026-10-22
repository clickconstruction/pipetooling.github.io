import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5740',
  date: '2026-10-22',
  title: 'Messages: the walk starts when asked',
  kind: 'fix',
  highlights: [
    'The walk kit’s one command printed nothing and did nothing on its first try. It now starts the walk every time it is run.',
    'Nothing changes for the office.',
  ],
}

export default note
