import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7653',
  date: '2026-11-17',
  title: 'Trips: the rules for a trip to a site away from home',
  kind: 'infra',
  highlights: [
    'The first piece of the trip record. It is the rules alone, and no screen changes yet.',
    'A trip is people and days. Each day is Getting ready, On the road or At the site, and where a trip stands is read from its days: Planned, Out now or Back.',
    'Hours on a trip day take that day’s kind. A punch counts At the site only when its place is the site. A row with no place is its own figure and is never added to At the site.',
    'Hours on the site’s jobs outside every trip read At home for the site. The app may say Looks like a trip, and only a person makes one.',
  ],
}

export default note
