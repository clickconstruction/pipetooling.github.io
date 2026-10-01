import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4303',
  date: '2026-10-01',
  title: 'Edit Job → Bill: Still to bill leaves out work a bill already covers',
  kind: 'fix',
  highlights: [
    'A bill made for an amount, not by picking line items, now counts. Work it covers no longer shows under Still to bill.',
    'Work covered only in part shows what is left, and how much of it is already billed.',
    'A stage that passed no longer waits on the stage above it when a bill already covers that stage.',
  ],
}

export default note
