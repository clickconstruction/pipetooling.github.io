import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3487',
  date: '2026-09-16',
  title: 'Submittals: the reviewer decides on the room — a name once, then Approve / Revise / Reject with a note, and their calls land on your rows',
  kind: 'feature',
  highlights: [
    'On the review room, tapping Approve, Revise or Reject asks once who you are — name, email, and whether you are the architect, the owner\'s rep, the designer or the builder — then remembers you on that device and rewrites the address to your personal link. "Send my review" records every decision with your name; "Approve all as marked" clears the rows that differ in one tap.',
    'Someone marked watching on the tab sees the page but cannot send. A decision against an older revision is refused with a plain sentence to reload.',
    'On the Submittals tab: a Their call column and a summary line — "19 approved · 2 revise · 1 rejected · by Dana W." — with Copy their decisions as text, and a new door: "Rev 3 from the 2 rows sent back", a draft carrying only what was marked Revise or Reject.',
  ],
}

export default note
