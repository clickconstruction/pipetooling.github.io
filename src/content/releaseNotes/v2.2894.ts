import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2894',
  date: '2026-09-05',
  title: 'Marking a GC Won says what it will do first — and ↩ waiting really undoes it',
  kind: 'fix',
  highlights: [
    'Wherever you mark one GC Won on a multi-GC bid — Edit Bid, the Bid Board pill, Followup\'s Sent to — by GC, Waiting to hear, the Call queue — a confirm now says exactly what happens: "This marks the other GCs (named) Lost and the bid Won." If the bid was marked Lost by hand, it says that flips to Won.',
    '↩ waiting on the winner now puts everything back: the GCs the win marked Lost return to waiting, and the bid goes back to what it was (Not set, or the Lost you had set) — before, only the one pill changed and the bid stayed filed under Won.',
    'The per-GC win finally writes a Win/Loss note on the bid ("Marked Won via packet — GC · siblings marked Lost: …"), and so does the undo, so the notes ledger tells the whole story.',
  ],
}

export default note
