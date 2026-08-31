import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2539',
  date: '2026-08-31',
  title: 'Robot estimators can shadow live bids',
  kind: 'feature',
  highlights: [
    'The robot can now pick up a live bid and estimate it in parallel with your estimator — silently, before the real number exists — then score itself automatically the moment the real bid goes out.',
    'Every shadow result feeds a per-category confidence scoreboard, so you can see exactly where the robot is ready to help and where it still needs practice.',
  ],
}

export default note
