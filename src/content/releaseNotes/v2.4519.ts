import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4519',
  date: '2026-10-04',
  title: 'Pipeline stage bar: centered, with arrows between the stages',
  kind: 'fix',
  highlights: [
    'Each stage in the bar under the map is now centered in its space, where it used to hug the left.',
    'An arrow sits between each stage and the next, so the bar reads as the path a job takes: Waiting → Working → Ready to Bill → Billed Awaiting Payment.',
    'The arrow beside Collections points left. Collections is a side road off Billed Awaiting Payment, not the step after it.',
    'On a narrow window the arrows drop out first, so the stage names keep their room.',
  ],
}

export default note
