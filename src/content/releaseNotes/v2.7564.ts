import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7564',
  date: '2026-11-17',
  title: 'Stickers: a sticker gains a place to remember that its strips printed',
  kind: 'infra',
  highlights: [
    'A first step toward a true Not printed yet mark on a reserved sticker. Until now a run read as printed from the moment it was reserved, whether or not a strip came out.',
    'A sticker gains a place to keep when its strips last came out of the printer.',
    'Nothing on a screen changes yet. The counts on the reserved line and the press that prints only what never came out come next.',
  ],
}

export default note
