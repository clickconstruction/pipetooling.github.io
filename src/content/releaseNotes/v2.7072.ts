import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7072',
  date: '2026-11-12',
  title: 'Materials on site: the groundwork for stickers printed before their boxes',
  kind: 'infra',
  highlights: [
    'A sticker can now exist before its box. It has a code to scan and a short number to read, such as 0147.',
    'Nothing prints a run of stickers or puts one on a box yet. Those are the next two steps.',
    'Every label printed so far opens its box as before, signed in and signed out.',
    'A box now keeps its old name when someone renames it, with who changed it and when.',
  ],
}

export default note
