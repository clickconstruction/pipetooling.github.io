import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5545',
  date: '2026-10-14',
  title: 'GC projects: how the stage is going reads as one band, with the keys behind a link',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Under a project’s head, the verdict (On track, Watch, Behind), why, the Next button and the numbers now sit together in one block tinted by the verdict. A job on Watch looks different from one on track before you read a word.',
    'The row of stage dots above it (Bidding, Buying out, Building, Closed) is gone. The chip by the name and the board’s section already say the stage.',
    'The calendar is its own band, The clock, and the tiles are The trades. Each band has a Key link at the right that shows what its colours mean. The keys no longer take up room on every card.',
    'On a job being built, the work and money bars sit in the verdict block too, and the money team’s Bill day line ends it.',
  ],
}

export default note
