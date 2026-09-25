import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3820',
  date: '2026-09-25',
  title: 'A fact sheet for any big file, ahead of breaking it up',
  kind: 'infra',
  highlights: [
    'Developers get one command that reads a large screen file and lists its parts — every piece of state, what reads and writes it, the loaders, the database tables it touches and the blocks it draws — with exact line numbers.',
    'The same command lists every page the app serves and flags which big files have no plan for breaking them up, or a plan that has fallen behind the code.',
  ],
}

export default note
