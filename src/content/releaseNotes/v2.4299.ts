import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4299',
  date: '2026-10-01',
  title: 'View bill: the lien waiver sits at the top with the bill’s other papers',
  kind: 'feature',
  highlights: [
    'On a GC job, View bill now opens with one card for the bill’s papers. The first row is the lien waiver. It names the waiver and the money, and its button is the next move: Add waiver, Sign it, Send to the GC or Add the unconditional.',
    'A bill past its due date says how many days. A GC often waits for the waiver before it pays.',
    'Two dots show the pair. The conditional goes with the bill, and the unconditional follows once it is paid.',
    'When the GC has no email for waivers, the row offers the email the bill went to. One click saves it on the GC’s record.',
  ],
}

export default note
