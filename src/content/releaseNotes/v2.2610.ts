import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2610',
  date: '2026-09-01',
  title: 'Under the hood: smoother deploys',
  kind: 'fix',
  highlights: [
    'Migration deploys now handle two teams shipping at once without a manual retry, and edge-function deploys got the same one-command treatment.',
  ],
}

export default note
