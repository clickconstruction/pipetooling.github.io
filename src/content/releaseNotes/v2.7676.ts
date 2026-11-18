import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7676',
  date: '2026-11-17',
  title: 'Trips: the look says when punches look like a trip, and what shows a trip',
  kind: 'feature',
  highlights: [
    'When people punched in at a far site on days no trip covers, the Trips look says Looks like a trip, with who, how many days and when. The app never makes the trip by itself.',
    'Press Make it a trip to open a new trip already filled with those people and days. Nothing is saved until you press Save the trip.',
    'Press Not a trip and the page remembers it, so the same days are not offered again. A message offers Undo for one minute.',
    'An open trip now says What shows it: the punches at the site, the On my way and I’m here stamps, and the lines in History on its days.',
  ],
}

export default note
