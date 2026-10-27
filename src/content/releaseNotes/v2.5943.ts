import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5943',
  date: '2026-10-26',
  title: 'The review ask goes out the morning after a job is paid',
  kind: 'feature',
  highlights: [
    'The residential flow’s Review asked step now carries its own text. The morning after the last bill is paid, the app prepares the ask for Today’s sends on the Dashboard, where a person reads it and presses Send. The step starts on Offers, and Settings → Flows switches it to Off or Sends.',
    'The ask never goes to a customer who is waiting on an answer from us. Remind now on the step, or Nudge in the thread, asks any day. The rating link is made when the text goes, so a text put away never counts as asked.',
    'A new blank for the office’s lines, {portal}, is the customer’s short portal address. The app’s own Booked, Working, Done and Billed texts now end with that address when the customer has one, so every text points at the one link that is theirs.',
  ],
}

export default note
