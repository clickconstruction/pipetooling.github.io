import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4656',
  date: '2026-10-06',
  title: 'Help: numbered steps read as plain commands',
  kind: 'feature',
  highlights: [
    'A numbered step in a help guide now reads as commands: “Press Save”, not “You press Save”.',
    'The change covers 83 steps in 35 guides. Nothing else in those guides changed, and running text still talks to you as “you”.',
  ],
}

export default note
