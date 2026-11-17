import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7534',
  date: '2026-11-16',
  title: 'Bids: keep an email’s files as a set of plans, from the email itself',
  kind: 'feature',
  highlights: [
    'An email on a bid that carries a file now has Keep its files on the bid. Open the email in Messages and the press sits beside Open the bid. My email shows it too.',
    'The files go into the bid’s Drive folder, under Plans, and show on the bid as a set of plans. The form fills in the name, the date and the memo from the email.',
    'The button counts the files it will file. A file that stayed in Gmail is named and held, and a file that fails can be tried again on the same set.',
    'A kept email says Kept, with a door to the set. On the bid the set says From a mail, with a door back to the email.',
  ],
}

export default note
