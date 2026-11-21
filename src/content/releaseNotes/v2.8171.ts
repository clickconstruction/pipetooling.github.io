import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8171',
  date: '2026-11-21',
  title: 'A punch list card cannot say one thing twice',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A card that wrote the same field twice showed only the last one on the Punch list. One card showed a next step six days old that way.',
    'The check on every change now refuses such a card. It names the card, the field and the lines.',
    'Every card on the list was read with the new check. None repeats a field today.',
  ],
}

export default note
