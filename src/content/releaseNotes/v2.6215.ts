import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6215',
  date: '2026-10-31',
  title: 'Costs on the Jobs & bids table of a Development page, for devs and controllers',
  kind: 'feature',
  highlights: [
    'On a Development page, a dev or a controller sees a Costs column in the Jobs & bids table: each job\'s parts and sub labor as one figure, the same number the job window\'s profit band shows.',
    'Rest on the figure to see the buckets: supply houses, card, tally, other charges, sub labor. A job with nothing spent reads none yet.',
    'Every other role sees the table as before, with no Costs column.',
  ],
  roles: ['dev', 'controller'],
}

export default note
