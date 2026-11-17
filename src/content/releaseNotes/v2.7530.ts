import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7530',
  date: '2026-11-16',
  title: 'Lien desk: the book, counsel’s grid and the Lien window count what the bills owe',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The By job book and the attorney’s lien grid showed a job’s whole price less payments as unpaid. A job billed one stage of three read as owing the stages never billed. Both now show what the sent bills still owe, the same figure the notice claims.',
    'On a sent notice, GC paid, the still owed words and the two doors under them read the bills too.',
    'The Lien window’s timeline and its supply houses card read the bills, as its papers already did.',
  ],
}

export default note
