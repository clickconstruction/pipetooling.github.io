import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5854',
  date: '2026-10-25',
  title: 'The Collect desk, PR 3 of 7: the one move on each payer, and the week’s plan',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Each payer’s row on the Collect desk now ends with the one move that lands the money soonest: call the broken promise, ask whether the pay application is approved, send the statement then call, ask about the one late bill, or send the statement alone. Under it, the words to say, built only from what the desk knows.',
    'The lien paper sits beside the move with its door, and an owner and day chip you type once. Only you can decide these: the payers that read as a GC while the job records them as the customer, a lien affidavit with its window open, a slow payer who needs terms, a dispute recorded this week.',
    'The third tile reads the guess, stated as one: if half of what the moves ask for lands in three weeks, where the pile stands and who holds the link. Record this as the week’s plan writes the moves and their owners into the Bridge’s call, and Copy the call sheet hands the sheet to whoever makes the calls.',
  ],
}

export default note
