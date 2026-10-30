import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6104',
  date: '2026-10-29',
  title: 'Legal desk: the Paper tab opens on the lien calendar, with the next step’s button and the deadlines as chips',
  kind: 'feature',
  highlights: [
    'Where each job stands on the Legal desk now opens on the calendar: each paper a bar from its first day to its last, today a line, the closed windows struck. Steps is one press away and the desk remembers your choice apart from the Lien window’s.',
    'The next step on the path carries its own button at the right of the verdict band — Draft the notice…, Go to the affidavit…, Record the release… — opening the Lien desk or the Lien window where that paper is made.',
    'A lien deadline under Before this goes to an attorney reads as a chip with its day and its days left instead of a sentence. The printed packet keeps the sentence.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
