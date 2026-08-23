import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2127',
  date: '2026-08-22',
  title: 'Roadmap: empty stages with nothing before them read "not planned yet"',
  kind: 'fix',
  highlights: [
    'A roadmap stage with no tasks and no stage leading into it no longer shows as ✓ reached — the Timeline, Plan, Goals strip, and Map now mark it "not planned yet" with a hollow, dashed marker.',
    'Milestones still work the same way: a task-less stage that follows other stages is reached once those stages finish.',
    'Stages that depend on a not-planned-yet stage stay locked until it gets tasks or a predecessor.',
  ],
}

export default note
