import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5904',
  date: '2026-10-26',
  title: 'The Pipeline row, the job window and every Call button count their presses',
  kind: 'feature',
  highlights: [
    'Every button on a Pipeline row and on the job window writes one line to the usage ledger, named by the button, so Settings → Usage can say which of the row’s doors the office presses.',
    'A press on a Call button is recorded with the surface it sits on: a Pipeline row, a call task, a thread, the customer door, a waiting customer, a supply-house rep. The call itself is unchanged.',
    'The ledger is dev-read only, as before. A button is recorded by the app’s own words, so a customer’s, a company’s or a person’s name never lands in it.',
  ],
}

export default note
