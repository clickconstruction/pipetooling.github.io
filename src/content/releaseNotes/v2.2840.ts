import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2840',
  date: '2026-09-05',
  title: 'A paid progress bill no longer marks a job 100% done',
  kind: 'fix',
  highlights: [
    'Jobs → Job Summary: the % column reads 100% only when the work is done (latest crew report or the job’s own %) or when the whole contract is billed and paid. One paid progress bill on a job still being worked now falls through to the crew’s and the office’s %.',
    'The Finished (100%) filter, earned revenue, true profit, and the Months, Scatter, Cycle, Cut-by and Compare views all follow the corrected % — a progress-billed job in the field no longer shows full-contract revenue as finished.',
    'Jobs with no Total Bill set still read 100% when their invoice is paid, so Quickfill’s “Complete, no Total Bill” list is unchanged.',
  ],
}

export default note
