import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7163',
  date: '2026-11-13',
  title: 'Bill Customer: one press makes the Stripe bill and emails it',
  kind: 'feature',
  highlights: [
    'The Stripe bill tab now has two presses. Make the bill and email Dana makes the bill and sends the bill email in one press. Before, the bill was made on one screen and sent on the next, and a bill could be made and never sent.',
    'Make the bill, send later makes the bill and sends nothing. Use it for a bill you hand over or text.',
    'The box above the presses says the email goes now and to which address. With someone else ticked, the press reads Make the bill and email 2 people.',
    'The next screen says how the email went, then offers the text. If the email could not go, the bill is still made, and the screen says why and how to send it.',
  ],
}

export default note
