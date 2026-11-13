import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7157',
  date: '2026-11-13',
  title: 'Bill Customer says what the customer will get before you press',
  kind: 'feature',
  highlights: [
    'Each tab now says under its name what reaches the customer. A Stripe bill is an email with a Pay now button. A Physical invoice is an email with the PDF attached and no pay link.',
    'Send to names who is billed beside the address. On a Stripe bill it also shows the phone on the job, since a text can follow.',
    'A box above the press says what the press does. Making a Stripe bill sends nothing, and the box says so. The next screen sends it by email or by text.',
    'The presses are named for what they do: Make the Stripe bill, and Email the invoice to Dana, or to 2 people when someone else is ticked.',
  ],
}

export default note
