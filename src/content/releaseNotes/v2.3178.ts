import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3178',
  date: '2026-09-08',
  title: 'The job window names its team labor',
  kind: 'feature',
  highlights: [
    'The Job tab’s cost block now leads with a Team labor row — total, hours, and who — for owners, controllers and master techs. Expand it for the per-person split. The 👷 marker on the Cost Timeline was carrying this number all along; now it is written down.',
    'The Cost Timeline’s marker key is always visible under the chart instead of hiding behind "what do the markers mean?".',
    'Jobs → Job Summary: when a search finds a job the Show chip is hiding (a job still in the field under Finished), the empty state says so and offers "show all statuses" in one tap.',
  ],
}

export default note
