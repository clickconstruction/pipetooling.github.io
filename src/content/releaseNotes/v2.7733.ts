import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7733',
  date: '2026-11-18',
  title: 'Bill Customer: the Send to block is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the Send to block of the Bill Customer window moved into its own file: who the bill goes to, the contacts to copy, the other party, and the one-off address.',
    'Nothing changes on screen. Every tick and the one-off box read and save exactly as before, and no send or record press was touched.',
  ],
}

export default note
