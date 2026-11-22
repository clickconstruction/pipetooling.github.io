import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8211',
  date: '2026-11-21',
  title: 'Maps: Google’s own shop and landmark labels are off',
  kind: 'fix',
  highlights: [
    'A Google map in the app no longer draws Google’s own labels for shops, restaurants, theatres, landmarks, parks and bus stops. They crowded a painted line and could sit under a dot.',
    'Street names, road numbers and the names of towns and neighbourhoods stay, and Google now fits more street names in the room.',
    'It is the same on a painted map and on every map of dots, on the photograph and on Streets, in light and in dark.',
    'Nothing else about the maps changed, and no map is opened sooner or more often.',
  ],
}

export default note
