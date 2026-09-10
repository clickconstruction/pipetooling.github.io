import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3225',
  date: '2026-09-10',
  title: 'Robot Board: every live bid, with the door that moves it',
  kind: 'feature',
  highlights: [
    'The Robot Board now lists every live bid, not just the ones a robot has run. A bid the robot can’t start on shows amber with the reason and one door — Paste the plans, Share the plans, or Answer — that opens the robot’s needs sheet. The section header counts them; each one you clear is a free practice run.',
    'A bid marked sent without a value shows an Add bid value door. The robot’s sealed number scores the moment the value is on the record.',
    'Under a scored row, “where the delta lives” splits the difference into missed, added, counts, and priced differently, with the robot’s own note on what it was least sure of.',
    'Sealed rows say whose number they will score against, and flag a practice teacher before you send. The strip speaks plainly: sealed and waiting on you, need something from a person, kinds of job that have earned first drafts. The live count no longer includes old leads that were never sent.',
  ],
}

export default note
