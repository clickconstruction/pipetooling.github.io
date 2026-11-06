import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6574',
  date: '2026-11-06',
  title: 'A pressed step on the Lien desk opens a brief and sorts the list, and § Rules shows our schedule after a notice',
  kind: 'feature',
  highlights: [
    'Press a step on the Reminders strip and a brief opens under it: what the step is, why a notice is on it, the usual move and whose it is, the other moves you may take instead, and what closes it by itself. Every step puts the list back.',
    'The list under a pressed step sorts into On this step and On other steps. No row fades and every button still works. The Showing line and the fade of v2.6522 are gone, on every strip.',
    'The brief opens with a strip of days from the packet: day 7 a courtesy may go, day 10 letter two is due, day 14 overdue, then the week before the affidavit’s day and the day itself. Each notice on the step shows its own day on it.',
    '§ Rules carries the same strip under Our schedule after a notice, with whose rule each day is: the owner’s choice, counsel’s rule, our margin, or the law.',
  ],
}

export default note
