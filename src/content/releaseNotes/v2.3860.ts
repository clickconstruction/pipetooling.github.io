import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3860',
  date: '2026-09-26',
  title: 'Pipeline: the man-hours sums are one tested piece',
  kind: 'fix',
  highlights: [
    'The Pipeline’s man-hours total on each row and the per-person breakdown on hover were summed inside the board; the two sums now live together in one small tested module, and the test pins that the breakdown always adds up to the total.',
    'Nothing on screen changes.',
  ],
}

export default note
