import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6337',
  date: '2026-11-02',
  title: 'Projects: the stages follow each line’s own budget, and the Costs tab opens the project on the board (punch list #242, PR 5)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'A line the owner tuned on the Costs tab now moves its stage’s piece of the strip on the Projects board. The track still reads the labor budget; the pieces follow the per-line budgets.',
    'The Costs tab’s Where we are card has a door to the project’s card on the board, which opens large on arrival.',
    'A door to a job that is not on the board says so, and why.',
    'The Projects press on the Pipeline sits in line with Follow-ups and Forecast, a button in its own blue.',
  ],
}

export default note
