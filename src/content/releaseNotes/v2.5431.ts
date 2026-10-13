import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5431',
  date: '2026-10-12',
  title: 'Dispatch: a running late move slides the board with its reason, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When a tech running late moves their day, every stop that slides moves in one step, or none do.',
    'The late job gets one Running late line in its activity with the reason, such as said to Dana at 9:02 AM.',
    'Dispatch gets a note from the tech saying what moved, with the usual push.',
    'A slide past 8:00 PM, the end of the board’s day, moves nothing. Nothing on screen changes yet.',
  ],
}

export default note
