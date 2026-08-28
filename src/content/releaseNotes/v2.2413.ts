import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2413',
  date: '2026-08-28',
  title: 'Contacts are real records now',
  kind: 'feature',
  highlights: [
    'Edit Bid\'s "Last Contact" box is now Log contact… — pick how you reached them (call, text, email, in person), when, which GC, and what was said. It lands in the bid\'s notes like every other contact.',
    'BEHAVIOR CHANGE: only real contacts (with a method) move the last-contact clock now. Writing yourself a note no longer silences the "gone quiet" nag — so some bids will honestly reappear in Waiting to hear.',
    'Calls and chases now remember WHICH GC you talked to — per-GC last contact shows on Edit Bid\'s GC rows.',
  ],
}

export default note
