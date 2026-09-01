import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2555',
  date: '2026-08-31',
  title: 'Robot estimators can count symbols on scanned plans',
  kind: 'infra',
  highlights: [
    'The last plan-set class is covered: on pure-image scans where nothing is machine-readable, the robot now finds every copy of a symbol from a single example.',
    'First run re-counted the floor sinks a practice estimate had missed — found all nine, matching the human takeoff exactly, in under six seconds.',
  ],
}

export default note
