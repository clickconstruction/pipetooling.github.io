import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6598',
  date: '2026-11-06',
  title: 'The Roadmap counts fractions: Set the % on a task card, and a stage reads 2.5 of 6',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The task card’s dock carries Set the % where Mark done was: 25, 50 and 75 beside one green Done. A task with a card on someone’s Today writes through that card, so the thread and the Dashboard agree; a task with no card yet keeps the percent on itself.',
    'Every stage count adds the open tasks’ percents: the goal’s bar fills by them, the stage ledger and the Plan’s stage cards read 2.5 of 6 done, the Map’s stage badge too, and a Plan slot fills blue to its task’s percent.',
    'The stage unlocks on the same rule as before, every task at 100. Only the reading between changes.',
  ],
}

export default note
