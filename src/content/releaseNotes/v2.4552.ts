import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4552',
  date: '2026-10-05',
  title: 'Submittals: a long part name no longer runs over the answer beside it',
  kind: 'fix',
  highlights: [
    'In a medium-width window, a long maker and model in the rows table ran over the GC\'s answer next to it. The name now wraps inside its own column.',
    'When the table is too narrow for parts and answers side by side, each answer sits under its part, the way it does on a phone.',
  ],
}

export default note
