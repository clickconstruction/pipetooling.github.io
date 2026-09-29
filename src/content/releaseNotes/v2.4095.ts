import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4095',
  date: '2026-09-28',
  title: 'The home-screen icon stands clear of the glass',
  kind: 'fix',
  highlights: [
    'On iOS 26 the phone paints its glass over every web-app icon, and the band along the bottom edge was greying and smearing the gear’s lower teeth. The mark now sits further in from the edges of the tile, out of that band.',
    'The icon ships at four times the resolution it did, so the App Library, Spotlight and the large-icon layout no longer stretch it.',
    'Nothing changes on a phone that already has the app installed until the icon is added to the home screen again.',
  ],
}

export default note
