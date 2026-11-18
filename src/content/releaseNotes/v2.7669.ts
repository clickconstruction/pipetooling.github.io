import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7669',
  date: '2026-11-17',
  title: 'Supply houses: the move window is worked out in one tested place',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The move window’s strip, its worked list and the Needs You line count the same charges.',
    'The page worked out which charges can still move onto a job account in two places. It is one tested function now, and the check against the database calls that same function.',
  ],
}

export default note
