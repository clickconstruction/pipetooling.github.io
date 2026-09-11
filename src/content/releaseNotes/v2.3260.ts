import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3260',
  date: '2026-09-10',
  title: 'Overhead: the Days view shows who received it, and the Burn projection charges the same way',
  kind: 'feature',
  highlights: [
    'Job Summary → Days gains a Charged column — what actually landed on each day’s jobs after the app’s smoothing window and carry share, with the carry portion named beside it — and every job chip now carries the dollars it received that day. Hover Charged for the split.',
    'The Costs tab’s Burn projection (overhead so far and per field day) charges from the same app-wide setting as Job Summary, so the two never disagree.',
    'Under the original one-day method nothing changes: Charged equals Pool, so the column stays hidden until a dev sets the smoothing window or carry share.',
  ],
}

export default note
