import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5304',
  date: '2026-10-12',
  title: 'A trade’s portal says when its next pay application is due',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'On a job being built, the trade’s portal says the day its next pay application is due and the bill it goes on.',
    'After the cut-off it names next month’s bill.',
    'A new pay application starts with its period running to that bill day.',
  ],
}

export default note
