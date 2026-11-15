import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7352',
  date: '2026-11-15',
  title: 'Banking: a bank line says when it paid a sub, and can be matched from there',
  kind: 'feature',
  highlights: [
    'On Banking → Ledger a bank line that a sub payment is matched to says who it paid, with its sending number when one check paid several sheets.',
    'A bank line gets "Match to a sub payment…" when a payment fits it: the same amount, within three days. Choose the payment and the two are matched and the payment is ticked.',
    '"undo" beside a matched line takes the match off, and the payment\'s tick with it.',
    'Nothing is matched without a press, and a bank line one payment took is offered to no other. A transfer between the company\'s own accounts is no longer offered, here or on the Subs Ledger.',
  ],
}

export default note
