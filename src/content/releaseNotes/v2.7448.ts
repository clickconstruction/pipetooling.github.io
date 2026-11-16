import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7448',
  date: '2026-11-16',
  title: 'Lien desk: one name for each step, and one count of what waits on the leader',
  kind: 'feature',
  highlights: [
    'The Board now has the same two bins as the list: Approved · to print, then Approved · to mail.',
    'Every door to the run reads Print and mail with its count. Once every notice has printed it reads Enter mail numbers.',
    'The Board’s second tile counts everything waiting on the leader and names the two parts: to approve and to sign.',
    'The title bar says the same count of notices to sign, so the tile and the door agree.',
  ],
}

export default note
