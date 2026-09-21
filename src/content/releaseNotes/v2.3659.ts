import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3659',
  date: '2026-09-20',
  title: 'Office staff: add a quick call or email to your hours without clocking in',
  kind: 'feature',
  highlights: [
    'Took a customer call after hours? Under Clock In there is now a small link — ＋ quick call or email. Tap ＋5 for each five minutes (up to 30), say whether it was a call, an email or a text, type a few words, and tap the button — it reads the number back to you: Add 10 min.',
    'It lands on today’s hours like any other entry and goes to approval the same way, marked as a quick add so whoever approves hours can tell it from a punch.',
    'It will not land on top of hours you already have, reach into another day, or replace the clock — past two hours of quick adds in a day it asks you to clock in instead. The link is only there while you are off the clock, for assistants, controllers and estimators.',
    'New help guide: add a quick call or email to my hours.',
  ],
}

export default note
