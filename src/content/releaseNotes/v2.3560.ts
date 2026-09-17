import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3560',
  date: '2026-09-17',
  title: 'The Punch list says which rows still need a drawing',
  kind: 'feature',
  highlights: [
    'A row with no mock-up beside it now reads "waiting on a mock-up"; one whose work changes no screen reads "mock-up not required" and why.',
    'A Waiting on a mock-up toggle by the filters shows only the rows that still need one — 17 of 37 today.',
  ],
}

export default note
