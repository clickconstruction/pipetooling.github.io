import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3500',
  date: '2026-09-16',
  title: 'Submittals: the review room\'s download link reads cleanly',
  kind: 'fix',
  highlights: [
    'On the live site the review room\'s PDF and review calls carried a doubled slash in their address. They worked, but the address now reads as it should.',
  ],
}

export default note
