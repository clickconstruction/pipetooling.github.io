import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7737',
  date: '2026-11-18',
  title: 'Bill Customer: the When you press box is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two small parts of the Bill Customer window moved into their own files: the When you press box above each send, and the line on the made-bill screen that says how the bill email went.',
    'Nothing changes on screen, and no send or record press was touched.',
  ],
}

export default note
