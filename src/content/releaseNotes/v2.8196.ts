import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8196',
  date: '2026-11-21',
  title: 'Punch list: a place to keep each person’s “working on it” ticks',
  kind: 'infra',
  highlights: [
    'The database can now keep a tick beside a punch list card that means “I am working on this”.',
    'A tick belongs to the person who made it. Nobody else sees it.',
    'Each tick remembers the section its card was in, so a card that moves to another section can lose its tick.',
    'Nothing on screen changes yet. The checkbox comes next.',
  ],
}

export default note
