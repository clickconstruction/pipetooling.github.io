import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8722',
  date: '2026-11-27',
  title: 'The trade portal’s ticks, picks and file picker fit a thumb on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the portal’s buttons already stand 44 px tall. Its ticks, its drop-down picks, the line that opens a fold and the file picker did not.',
    'Each of those now stands 44 px tall on a phone too. A tick is pressed by its whole line, so the line grew and the box kept its size.',
    'The boxes you type in are unchanged, and at a desk nothing changes.',
  ],
}

export default note
