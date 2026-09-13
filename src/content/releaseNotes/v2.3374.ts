import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3374',
  date: '2026-09-13',
  title: 'Payment promises are filed under whoever pays the bill',
  kind: 'fix',
  highlights: [
    'A promise recorded on a job now sits with the party the job bills (Bills go to), not automatically the GC — a homeowner’s promise on a job that names a GC stays on the homeowner’s record.',
    'A GC’s reliability record ("keeps 3 of 7 · slips ~9d") and pay-speed spread only count promises on bills the GC actually pays.',
    'Promises customers make for themselves on the portal are unchanged.',
  ],
}

export default note
