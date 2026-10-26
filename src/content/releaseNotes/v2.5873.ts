import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5873',
  date: '2026-10-26',
  title: 'The Collect desk keeps its word after the call',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'After the call, the sheet does what its window says. A call that named no date waits three days off the sheet. A promise waits for its day. A dispute leaves the sheet for the red strip. A second miss on an account puts the owner on the next call.',
    'The third tile starts from the card’s weeks, on what is already late, so it reads 8.3 weeks like the card, not 10.2. Its twelve-week number is the dial’s.',
    'The after-the-call window no longer reads “Invalid Date” before a day is picked. A broken promise reads its day in words, and the lien lines read as sentences.',
    'Put the GC on the job now opens that job’s Edit Job, not the whole board.',
  ],
}

export default note
