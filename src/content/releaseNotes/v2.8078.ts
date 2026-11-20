import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8078',
  date: '2026-11-20',
  title: 'Painted maps: a map waiting on Google Maps says it is loading',
  kind: 'fix',
  highlights: [
    'A saved painted map that is waiting on Google Maps now says Loading the map… in its frame. Before, the frame was a blank white box.',
    'On a weak signal that wait can last ten seconds before the view from above comes up in its place.',
    'Nothing else changes. The lines and the places draw the moment either map is up.',
  ],
}

export default note
