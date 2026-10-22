import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5744',
  date: '2026-10-22',
  title: 'Robots: a refused setup code says its one thing once',
  kind: 'fix',
  highlights: [
    'When Set up on this Mac’s command is refused because its code expired or was already used, the Terminal line now says to press Set up on this Mac again once, not twice.',
  ],
}

export default note
