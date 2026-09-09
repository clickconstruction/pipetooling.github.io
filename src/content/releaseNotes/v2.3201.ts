import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3201',
  date: '2026-09-09',
  title: 'Mark a bid reviewed',
  kind: 'feature',
  highlights: [
    'The Review step of the bid flow has a button now. Mark reviewed asks for any notes, then stamps who reviewed the bid and when. The strip shows “by Wendi · Sep 9” under Review, and the notes sit in the tooltip.',
    'The review also lands in the bid’s notes timeline as a plain note, so the story is there next to everything else — without moving the bid’s last-contact clock.',
    'Review now counts as a real step: the strip says “of 10”. Robots cannot mark a bid reviewed; that stays a person’s call.',
  ],
}

export default note
