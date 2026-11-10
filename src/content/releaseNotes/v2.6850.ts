import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6850',
  date: '2026-11-10',
  title: 'Permits: anyone can keep a passed permit, and every card shows its history',
  kind: 'feature',
  highlights: [
    'Under Closed, every passed permit now has a Keep press. Anyone can use it, on their own pass too, and the permit moves to Kept under their name.',
    'A card that was answered before shows a History row with its last two moves, such as \u201cSam passed, Nov 9: too far\u201d.',
    'Open any permit to read its whole history under What we did. It used to show on kept permits only.',
  ],
}

export default note
