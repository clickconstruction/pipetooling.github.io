import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2091',
  date: '2026-08-22',
  title: 'Checklist History: repeating grid + one-off ledger',
  kind: 'feature',
  highlights: [
    'The History grid now shows only repeating tasks, and each row starts the day the task was created — "since 6/14" under the title, a blue tick on its first day, no more empty boxes for days a task didn\'t exist.',
    'One-off tasks moved to their own list below: one line each with created → done dates, instead of a grid row of a hundred empty boxes hiding a single ✓.',
  ],
}

export default note
