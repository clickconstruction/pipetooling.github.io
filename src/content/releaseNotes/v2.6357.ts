import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6357',
  date: '2026-11-02',
  title: 'A clean build no longer waits in line for the SQL beds check',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When the SQL beds pass or are not needed, their required check now passes at once instead of waiting behind every other job for a runner. On the night of November 1 that wait cost one merge 54 minutes and held pull requests with no beds for up to 84.',
    'A failed, cancelled or timed-out bed still fails the check and holds the merge. So does a bed that was wanted but never ran.',
    'If the step that decides which beds to run cannot read the changes, it now fails instead of saying none are needed.',
  ],
}

export default note
