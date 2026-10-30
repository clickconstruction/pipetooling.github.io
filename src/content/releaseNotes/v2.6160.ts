import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6160',
  date: '2026-10-30',
  title: 'The Workbench’s margin as two bars, a trial',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Press Show the bars on the Pricing strip and the four tiles become two bars on one scale: a revenue bar with the figure the bid went out at and what today’s book adds as a sliver, and a cost bar in its parts, labor, materials, the book’s drift, the rows with no cost as a dashed stretch, and the margin as the rest. Profit, Margin and Multiple stay as tiles beside them.',
    'The five caveat sentences under the strip become the legend under the cost bar, each on the part it touches with its door: the default crew rate opens Labor, the drift opens Takeoffs, the rows with no cost show those rows. The margin the bid went out at is a ghost mark on the cost bar.',
    'The bars stay off until you turn them on, and the switch is remembered on your device.',
  ],
}

export default note
