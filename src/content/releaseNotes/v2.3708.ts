import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3708',
  date: '2026-09-22',
  title: 'Punch list: every row has a number',
  kind: 'feature',
  highlights: [
    'Every row on the Punch list now opens with its number — #16, #27 — in its own column, so a note, a request or a conversation can name a project in two characters instead of a sentence.',
    'A number is given once, when the project is written up, and never reused: when a row is finished and leaves the board, its number leaves with it, so #16 always means the same work.',
    'The number is part of each project’s write-up in the repo; the board refuses a project without one or two that share one, and says which number is next.',
  ],
}

export default note
