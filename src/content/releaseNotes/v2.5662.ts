import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5662',
  date: '2026-10-20',
  title: 'The app’s own description of the database knows a bid’s tax rate and a row’s kind, tags and split',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. bids.tax_rate_pct and the five new count-row columns are in the app’s generated description of the database and the dev seat’s catalog.',
    'The two migrations behind punch list #128 were applied on the live database first, each after its PR landed.',
  ],
}

export default note
