import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4071',
  date: '2026-09-28',
  title: 'Write up a change: pick a half-done write-up back up',
  kind: 'feature',
  highlights: [
    'Close a write-up before sending it and the next time you open Write up a change it asks first: pick it back up, start fresh, or leave it for the office.',
    'Pick it back up brings back your words, the reason and schedule notes, the ballpark, the photos and the job, and lands you on "What\'s the change?".',
    'Start fresh keeps the old one in Estimates → Unsent and asks again next time; Leave it for the office keeps it there too but stops asking.',
  ],
}

export default note
