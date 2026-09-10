import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3234',
  date: '2026-09-10',
  title: 'Record your best effort on the Cover Letter, and the robot’s envelope opens before you send',
  kind: 'feature',
  highlights: [
    'A new card on the Cover Letter, between the proposed amount and Mark sent: Record best effort. One tap puts the number you would send right now on the record and opens the robot’s sealed number beside it — while the bid can still change. If the robot is still estimating, the envelope opens here when it locks.',
    'Your best effort is the number the robot is scored against from now on. It cannot be re-recorded after you have seen the envelope; the bid itself can change, and the bid note says by how much. Recording it also marks the bid reviewed.',
    'The Robot Board shows both numbers once a bid goes out — best effort → sent — with the dollars moved after the reveal on the row, and a strip line adding them up. That is the robot’s worth, per bid and in total.',
    'Bids sent without a recorded best effort work exactly as before: the score lands at send.',
  ],
}

export default note
