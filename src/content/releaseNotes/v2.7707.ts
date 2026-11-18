import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7707',
  date: '2026-11-17',
  title: 'Trips: each trip has a number, and a link that opens it',
  kind: 'feature',
  highlights: [
    'Each trip now has a number on its site: Trip 1, Trip 2. The app hands it out when the trip is saved. Nobody types it, it never changes, and it is never given to another trip, so Trip 5 means one trip for good.',
    'The number leads the trip everywhere a trip is named: its row and its heading in the Trips look, its two lines in History, the Job window’s line, Plans by date, the Scoreboard’s cut by trip, the delete’s question and the printed trip log.',
    'Copy link on an open trip copies a link that opens the site’s page with that trip open. A link to a trip that was deleted opens the Trips look and says the trip is no longer here.',
    'A trip’s name is now a door to it: the line in History, last and next in the Job window, the card on Plans by date and the row on the Scoreboard each open that trip.',
  ],
}

export default note
