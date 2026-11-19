import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7955',
  date: '2026-11-19',
  title: 'Prospects: you can take over a card a colleague left more than 30 minutes ago',
  kind: 'fix',
  highlights: [
    'When you start on a prospect in Follow Up, the app marks the card as yours, so nobody else dials it while you do. A mark older than 30 minutes is old, and the next caller takes it over.',
    'The database refused that takeover. On a prospect a colleague had dialed before, your mark was never written, so the card stayed on the other callers’ decks while you were on it.',
    'Now the takeover goes through. A mark a colleague made in the last 30 minutes is still never replaced, and their name still shows on the card.',
    'The old marks left on record were cleared. Nothing on screen read them.',
  ],
}

export default note
