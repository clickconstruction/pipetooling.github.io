import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3994',
  date: '2026-09-28',
  title: 'Contracts & terms: when it changed, what it said before, and when it was last read',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Last changed on a card now reads from the record: the day, and who changed it. History opens every version on record, each to read or to put side by side with today’s.',
    'What did it say on… — pick a day, and the card says which wording was in force. It answers for a customer who accepted on that day.',
    'Mark reviewed records that you read a contract and it still stands, with a note if there is one. A card is due a year after it was last changed or reviewed, whichever is later.',
    'The top of the tab counts the cards due for review and the ones never reviewed.',
  ],
}

export default note
