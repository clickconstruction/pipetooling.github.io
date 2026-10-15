import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5543',
  date: '2026-10-14',
  title: 'GC projects: each stage opens on a band like the Jobs pipeline',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On the Project Board, a stage’s heading was a card like the rows under it, so it was hard to see where one stage ended and the next began.',
    'Each stage now opens on a flat band in its own colour, the way the Jobs pipeline does. The count sits in a small pill beside the name, and the money and the one-line description stay where they were.',
    'By customer uses the same band for each customer’s heading.',
  ],
}

export default note
