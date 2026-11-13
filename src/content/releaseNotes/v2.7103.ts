import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7103',
  date: '2026-11-12',
  title: 'More supply house bills add up by themselves: the check learned what the papers print',
  kind: 'fix',
  highlights: [
    'On Materials → Supply houses, some bills read a gap although the paper was right. Pipe priced by the foot and rounded, a box priced by the piece, a shipping charge under the subtotal and a rebate among the parts each looked like a mistake.',
    'The check now knows each of these, and a line that was ordered and not shipped. A bill held for one of them is checked again by itself over the next few hours and turns to *adds up* with no press.',
    'The Look window says what it allowed under the sum, such as *Line 7 is priced by the piece, 50 to a pack.*',
    'A bill whose total is not the amount typed on its row still waits for a person, and so does one with a line missing.',
  ],
}

export default note
