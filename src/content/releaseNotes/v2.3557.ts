import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3557',
  date: '2026-09-17',
  title: 'The punch list links every mock-up and update',
  kind: 'fix',
  highlights: [
    'Every row on the to-do board now carries its own links: the mock-ups drawn for it (rendered, one click), the design artifacts it mentions, the docs fragment for each version it cites, and the history of every PR that touched it.',
    'The board is published with those mock-ups beside it and with shared picks turned on, so several people can work through it together — each Do / Later / Drop says who made it.',
    'Standing lists (Next up, Owner decisions pending) no longer take a pick or count as open items; the board and its filters agree on 37.',
  ],
}

export default note
