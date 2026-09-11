import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3335',
  date: '2026-09-11',
  title: 'The Bridge checks its own math: paper profit vs. the bank',
  kind: 'feature',
  highlights: [
    'A new Truth check panel under the net position chart puts the 8-week profit on paper next to how far net position actually moved over the same days, and says whether the two agree.',
    'The gap is split exactly in two: money earned but not yet invoiced (real, just unbilled) and costs the paper doesn\'t see (hours awaiting approval, unsorted bank spend, jobs assumed half done).',
    'The verdict on the right says it plainly: steer by the profit rate, bill the unbilled work to see it, or not a number to steer by yet — with the rows to fix listed underneath.',
  ],
}

export default note
