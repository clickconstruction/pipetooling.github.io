import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2881',
  date: '2026-09-05',
  title: 'Robots: the last three steps that needed a workaround become one call each',
  kind: 'fix',
  highlights: [
    'A robot can now attach its plan read to the bid, put its questions straight onto the audit card, and — only after its scorecard is on record — open the reference rows for the line-by-line comparison.',
    "The reference rows stay locked until the robot's own number is committed, by construction — the same order-of-operations that protects the blind estimate on the way in.",
    'Questions arriving without a plan-sheet anchor get called out, so the auditor never has to hunt for what the robot meant.',
  ],
}

export default note
