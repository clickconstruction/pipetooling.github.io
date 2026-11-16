import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7429',
  date: '2026-11-15',
  title: 'CI gives the checks 60 minutes, so a slow run no longer drops a good pull request from the merge queue',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The checks had a 40-minute limit, and passing runs now take up to 39.5 minutes as the test suite has grown.',
    'On November 15 that limit cancelled two good builds in the merge queue. Each pull request was dropped from the queue and had to start over.',
    'The limit is now 60 minutes. A check that truly stalls still fails instead of holding up the merge queue.',
  ],
}

export default note
