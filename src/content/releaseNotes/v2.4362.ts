import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4362',
  date: '2026-10-01',
  title: 'Pay speed counts each payment for whoever the bill went to',
  kind: 'fix',
  highlights: [
    'A bill the GC pays now teaches the GC’s pay speed, not the homeowner’s.',
    'Jobs billed only to a GC count again. RMC- Dudley Mason now has his own pace of about 35 days.',
    'Same-day card payments count toward pay speed, as the Data health list already showed.',
    'The payment forecast email uses the same pay speeds as the app.',
  ],
}

export default note
