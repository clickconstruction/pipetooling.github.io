import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5269',
  date: '2026-10-12',
  title: 'Messages: the database side of contracts built from clauses',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. The database can now keep a contract’s clauses, each for everyone or for the trades named on it.',
    'A change by the office waits for a controller or a dev to approve it. Their own changes go out at once, and every change is kept.',
    'A change made against words that moved on since is refused, so a newer change is never overwritten.',
    'A signed copy keeps the clauses it was signed with, and the database will not let them be rewritten.',
  ],
}

export default note
