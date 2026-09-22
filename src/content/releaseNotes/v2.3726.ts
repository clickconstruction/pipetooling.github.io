import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3726',
  date: '2026-09-22',
  title: 'Day book: the schedule keeps a ledger',
  kind: 'feature',
  highlights: [
    'Every block added, moved, handed to someone else or removed on the Schedule board is now recorded with who did it, so the Day book can say Updated the schedule · 6 people · 9 blocks · Thu–Fri.',
    'The Schedule chip on the Day book is live, the range strip counts blocks changed, and the Month view gains a Schedule row.',
    'Nothing changes on the Schedule board itself. A change the app makes on its own, with nobody signed in, is counted on the day header rather than credited to a person.',
  ],
}

export default note
