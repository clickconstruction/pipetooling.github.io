import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4550',
  date: '2026-10-05',
  title: 'Submittals: step 1 is a few short rows, and the robot is one line',
  kind: 'feature',
  highlights: [
    'Where the rows come from is now one short row per source: its name, its count and its button. The explaining sentences moved to a hover line on each name.',
    'The robot shrank from a box to one small line. A chip says what it is doing, and the one thing to press sits beside it. A stuck ask is amber and names the day you asked.',
    'Rest the pointer on the robot\'s line, or tap its chip, and a card opens with the full story. The robot\'s offer on a vendor PDF and on a reviewer\'s file is the same one line.',
    'Once your rows exist, step 1 folds to one line, even while a robot ask is waiting. The line says what the robot is doing. Press the small arrow after the title to open it again.',
  ],
}

export default note
