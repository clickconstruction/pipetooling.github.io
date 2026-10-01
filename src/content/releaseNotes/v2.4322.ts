import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4322',
  date: '2026-10-01',
  title: 'Submittals: the GC calls each part',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'On the review room, a row with parts lists each part the GC sees, with its own Approve, Revise and Reject. "Approve all" approves the parts still open.',
    'A part sent back sends the row back. The row is approved once every part is. Your rows show each part’s call.',
    'Rev N+1 from the rows sent back keeps the parts already approved. The GC is asked only about the parts sent back.',
    'Entering their call by hand, or "They approved all of it", lands on a row’s parts too. You can pick which parts a call covers.',
  ],
}

export default note
