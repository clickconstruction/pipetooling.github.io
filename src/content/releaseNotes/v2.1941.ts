import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1941',
  date: '2026-08-20',
  title: 'Drag roadmap stages into order',
  kind: 'feature',
  highlights: [
    'New "Order stages" button on the Roadmap Map toolbar: drag stages up or down and the numbers renumber live — the top stage is always #1.',
    'Saving updates the stage-number badges everywhere at once, on both the Map clusters and the Plan rows.',
    'Each row shows the stage\'s status while you sort — done, tasks remaining, or locked.',
  ],
}

export default note
