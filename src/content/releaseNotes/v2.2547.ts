import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2547',
  date: '2026-09-01',
  kind: 'feature',
  title: 'Report cards for old bids — the robot icon grades them',
  highlights: [
    'On won, lost, and started bids the robot icon now wears a grade badge: A (green) means robots can fully learn from the record; B–D (amber) means partly; X (grey) means no plans on file.',
    'Click the badge to see exactly what the record is missing and the quickest fix — the same one-tap improvements as the yellow-icon checklist, aimed at history.',
  ],
}

export default note
