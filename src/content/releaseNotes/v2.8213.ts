import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8213',
  date: '2026-11-21',
  title: 'Painted maps: the lines show at once while Google Maps loads',
  kind: 'fix',
  highlights: [
    'A painted map opened to be read now draws its lines and numbered places at once, on a blank ground, while Google Maps is still loading. Before, the frame held only the words Loading the map… for up to ten seconds on a weak signal.',
    'Google’s photograph then comes in under the lines, and nothing moves: each line and place is already on its spot.',
    'A place can be pressed during the wait. The drawing cannot be dragged or zoomed until the map is up.',
    'The words Loading the map… sit at the bottom of the frame while the lines are drawn, so they never cover a line.',
  ],
}

export default note
