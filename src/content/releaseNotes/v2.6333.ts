import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6333',
  date: '2026-11-01',
  title: 'CI gives the checks 40 minutes, so a slow run no longer cancels a good pull request',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The checks on a pull request had a 30-minute limit, and recent passing runs reached 29.8 minutes as the test suite grew.',
    'On November 1 that limit cancelled two good pull requests. One of them was cut off 2 seconds after all 3,935 test files had passed.',
    'The limit is now 40 minutes. A check that truly stalls still fails instead of holding up the merge queue.',
  ],
}

export default note
