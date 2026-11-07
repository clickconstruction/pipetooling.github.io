import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6596',
  date: '2026-11-06',
  title: 'A pressed Reminders step draws one notice’s dated timeline, payments and all',
  kind: 'feature',
  highlights: [
    'The brief under a pressed Reminders step now draws one notice’s timeline down the card: the day the notice was mailed and where that date came from, the courtesy window, the attorney’s letter’s window, each payment since the notice with the amount and what is still owed, today as a band with the one press to make, the affidavit’s week, and the lien’s last day.',
    'Each row says what kind of thing it is in plain words, a legal requirement, a courtesy notice, the attorney’s letter, our rule or a payment, and its right side says what happens next with the days: 3 days left to send it, 9 days past the window, deadline in 10 days.',
    'Show another draws a different notice on the step. Why these are here reads as counts of the step’s own notices.',
    'Paid in full reads as a closed card with the old deadline struck through. Nothing is sent, held or approved differently.',
  ],
}

export default note
