import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3283',
  date: '2026-09-11',
  title: 'Customers can name their own pay-by date, and promises get captured where they happen',
  kind: 'feature',
  highlights: [
    'On the customer portal statement, once a bill is a week old, a "Can\'t pay today? Tell us when to expect it" strip offers three Fridays or any date — one tap, no sign-in. The date lands on the Billed row as "✓ Promised Sep 12 · customer" and in their record.',
    'The "mark promised date…" link on Billed rows is now "They said…" and asks who said it and how (phone, text, email, in person), so a promise carries its source.',
    'Recording a payment that lands two weeks or more after the bill asks "Did they promise a date for this?" — tap the day or a Friday before it, or skip. Answering records the promise from memory while it is fresh; nothing is guessed.',
    'Clearing a promised date now says so: the date comes off the board, the promise stays on record.',
  ],
}

export default note
