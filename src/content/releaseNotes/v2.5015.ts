import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5015',
  date: '2026-10-09',
  title: 'New Job and New Bid: the Deposit required? nudge reaches the GC',
  kind: 'fix',
  highlights: [
    'When the office gave up on a bill a GC owed, picking that GC on a new job or a new bid now shows the nudge to set Deposit required.',
    'It counts the jobs that billed the GC. A job the customer paid for leaves the GC out.',
  ],
}

export default note
