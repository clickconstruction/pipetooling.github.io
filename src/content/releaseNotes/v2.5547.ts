import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5547',
  date: '2026-10-14',
  title: 'GC projects: each trade on a project’s card is one row',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A trade used to be said three times on a card: a tile under how the stage is going, a heading with its budget, then the companies asked. Now it is one row under The trades, with the tile’s colour as a stripe down its left edge.',
    'The row says the trade and who has it, its scope, its budget or contract, where it stands, who is asked, what waits on whom, and the one thing to press, Compare quotes or Ask for quotes.',
    'The scope lines, the statement of work and the asks sit under each row as before. Press the arrow at the end of a row to fold it away, and again to open it.',
    'Press Key on The trades to see what the colours mean.',
  ],
}

export default note
