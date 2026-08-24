import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2237',
  date: '2026-08-24',
  title: 'Sub labor rows name Click-numbered jobs',
  kind: 'fix',
  highlights: [
    'Sub labor sheets on Click-numbered jobs showed just the bare number ("977") in the ledger — the job-name lookup only understood HCP numbers, so those rows lost their name.',
    'The lookup now recognizes Click numbers too, so every row reads "number | job name" and the ledger search finds those sheets by job name as well.',
  ],
}

export default note
