import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7220',
  date: '2026-11-13',
  title: 'Paint a map: walk or drive the line',
  kind: 'feature',
  highlights: [
    'Press Walk or drive it, and the line paints behind you as you move. A red bar says Painting for every second your phone is read, and it is read at no other time.',
    'Keep the screen on: the app holds it on for you. A phone’s browser cannot read where you are once the screen locks, so a phone in a pocket draws nothing. If the screen does go off, the map says the line has a gap and asks what to do with it.',
    'Done opens Look it over. Nothing has left your phone yet. Fix a line by hand, leave one out, or throw the walk away. A saved line is only a shape, with no time along it.',
    'A walked length is rough: a walked 50 feet can read 35 or 65. Use it for how far, never for a number you will price.',
  ],
}

export default note
