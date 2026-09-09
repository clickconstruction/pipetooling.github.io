import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3194',
  date: '2026-09-09',
  title: 'Fix: the stage picker now appears on split jobs',
  kind: 'fix',
  highlights: [
    'v2.3192’s stage list never loaded — the form fell back to the plain slider on every job. It now shows on any job with an Order stage.',
  ],
}

export default note
