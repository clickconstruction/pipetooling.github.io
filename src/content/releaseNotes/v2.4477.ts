import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4477',
  date: '2026-10-03',
  title: 'Submittals: a resubmit keeps the rows nobody has answered',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, Rev N+1 from the rows sent back now carries the rows with no answer too. Before, they dropped off the draft and off the procurement log.',
    'Only a row the GC approved stays behind, on the revision it was approved on.',
    'The button says so when rows still wait: Rev 2 from the 4 rows sent back and the 9 with no answer.',
    'The question before it builds counts each kind: sent back, no answer yet, approved.',
  ],
}

export default note
