import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5173',
  date: '2026-10-10',
  title: 'GC mode: the office can record who it told of new dates, and a trade can answer them, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'The schedule can now keep which trade partner was told of each move, and on what day.',
    'A trade partner’s answer to its new dates has a place to go: the dates work, or another day.',
    'Nothing on screen changes yet. Tell the trades and the portal’s answer come next.',
  ],
}

export default note
