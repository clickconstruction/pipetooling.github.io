import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2428',
  date: '2026-08-28',
  title: 'The digital twin write-fence',
  kind: 'infra',
  highlights: [
    'Twin accounts are now fenced at the database: they can read everything their role sees, but write only bids they created or are the assigned estimator on (plus filing bug reports). Assigning a bid to a twin is what grants it — un-assigning revokes.',
    'The fence binds only twins — real users are untouched, and can always review and edit twin work.',
    'New twin_runs ledger records every twin sign-in and mission for auditing.',
  ],
}

export default note
