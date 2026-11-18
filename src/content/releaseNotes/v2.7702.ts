import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7702',
  date: '2026-11-17',
  title: 'Trips: what a trip cost, the Scoreboard cut by trip, and a printed trip log',
  kind: 'feature',
  highlights: [
    'An open trip now says What it cost to a dev or a controller: the wages of the crew’s hours inside the trip, the card and bank charges dated in its days, and the two together. Nobody else sees a dollar on a trip.',
    'On a site with a trip the Scoreboard gains a cut by trip, beside job, part and person. Each trip that has gone out is a row with its hours, days, labor, charges and cost, and a last row, At home for the site, holds the rest of the hours, labor and parts. Hours, labor and parts add up to the site’s totals. Subs and overhead are not cut by trip.',
    'Print the trip log, beside + Trip, puts every trip of the site on one page: its days, who went, what for, who asked, how it went, its jobs, its billing and its hours. The page carries no dollars, and its copy is kept in Documents.',
    'A trip is still a reading laid over the clock. None of this changes a clock row, a bill or a cost.',
  ],
}

export default note
