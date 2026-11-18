import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7685',
  date: '2026-11-17',
  title: 'Trips: a job says its trips, a clock line wears its trip, and Plans by date gains a Trips lane',
  kind: 'feature',
  highlights: [
    'A job that a trip names now says Trips on this job in its window: how many trips went out, the last one with who went, and the next one planned. No extra job is needed to see a trip alone.',
    'Under that line the job’s hours stand in five figures: At the site, On the road, Getting ready, No place on the punch and At home for the site. Open the site’s trips goes to the site, and + Trip adds a trip with this job already picked.',
    'On a job whose site has trips, each clock line in the job’s feed wears a tag for its trip day, or a quiet chip that says at home for the site. A job on a site with no trip is unchanged.',
    'Plans by date on a site with trips gains a Trips lane under the sets. Each trip is a bar coloured day by day, and a planned trip is faint. Press a bar for its card, then Open the Trips look.',
  ],
}

export default note
