import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7158',
  date: '2026-11-13',
  title: 'Bill Customer shows the real email and the real text before the bill goes',
  kind: 'feature',
  highlights: [
    'On a Stripe bill, What Dana will get now has three faces: The bill, The email and The text. Looking at a face sends nothing.',
    'The email is the message the customer will read, with From, To and Subject over it. It is built the same way the send builds it, from this bill’s amount and due day.',
    'The text is the words a text would carry and the number it would go to. With no phone number on file it says so, before you make the bill.',
    'The bill’s own box is unchanged and is now headed On the bill.',
  ],
}

export default note
