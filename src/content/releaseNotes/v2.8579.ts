import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8579',
  date: '2026-11-25',
  title: 'GC card bills: the card page is due on the day the contract names, to the end of that day',
  kind: 'fix',
  highlights: [
    'A GC bill a customer turns to card was sent to Stripe as due in a count of days from the minute of the press. A bill due today fell due the second it was made.',
    'The card page is now made with the due day itself, to the end of that day, the same way a Stripe bill from Bill Customer is made.',
    'Paying by card is still switched off in Settings → Jobs, bills and liens, so no card bill was made the old way.',
  ],
}

export default note
