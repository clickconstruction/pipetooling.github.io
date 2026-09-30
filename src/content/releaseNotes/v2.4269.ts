import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4269',
  date: '2026-09-30',
  title: 'A job’s history shows when a payment was removed, not when it was added',
  kind: 'fix',
  highlights: [
    'Removing a payment from a job, for example a check that bounced, now shows in the job’s history at the time it was removed. Before, the removal showed at the same moment the payment was added, so it looked like an instant undo.',
    'Past removals were moved to the time they really happened, from the deleted-records log. Removals from before mid-July, when that log started, keep their old time.',
    'A payment a dev restores shows as added again, and removing it a second time shows too.',
  ],
}

export default note
