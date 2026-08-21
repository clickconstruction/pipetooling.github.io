import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2042',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Roadmap Timeline: every task gets its own bar',
  highlights: [
    'Each stage’s bar on the Timeline view is now one slot per task, laid end to end in task order — done tasks green in their true position, the next one up amber-ringed, the rest outlined. Hover a slot for the task name.',
    'Expanding a stage turns its task list into a waterfall: each task keeps its row (number, title, assignees) and its bar sits in its slot, so the cascade shows the order the work burns down at your pace.',
    'The stage’s done/total count moved next to its title, and tapping any task bar opens the task card.',
  ],
}

export default note
