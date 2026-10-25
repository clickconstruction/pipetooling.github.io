import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5855',
  date: '2026-10-25',
  title: 'The Collect desk, PR 4 of 7: after the call',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Each call on the Collect desk has an After the call line that opens one sheet with four answers: money is in the bank, they named a date, no date, or they dispute it. Pick one and the app records it as the Payment Chase touch or the promise it already keeps, with their words.',
    'The rules the office settled: a mailed check is a promise dated by the mail, the mail day plus five; a pay app approved for the next run is a promise with the run’s date; no answer or a wrong contact is could not reach, while spoke with no day named is a note; a pay app they rejected is the dispute.',
    'Money is recorded where money lives: the first answer sends you to the customer’s page to record the payment and keeps a note that it came after a call, so Friday can tell a payment that followed a call from one that was coming anyway.',
  ],
}

export default note
