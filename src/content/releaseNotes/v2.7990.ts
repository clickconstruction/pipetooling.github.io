import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7990',
  date: '2026-11-19',
  title: 'Painted maps: read a saved map on Google Maps',
  kind: 'feature',
  highlights: [
    'A saved painted map now opens on Google Maps. From above is Google’s photograph with the street names, and Streets is Google’s road map.',
    'Draw a line or add a place and the map goes back to the view from above the app has always used. It stays there until you close the map, so a new line sits on the photograph you drew it over.',
    'Time, a picture and a printed page still use the view from above. The page a link opens is not on Google Maps yet.',
    'When Google Maps cannot load, the map opens as it did before. Nothing on a map is lost.',
  ],
}

export default note
