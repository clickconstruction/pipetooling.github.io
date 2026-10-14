import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5522',
  date: '2026-10-14',
  title: 'Lien desk: a notice printed and in the mail wears its own mark on Deadlines',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Lien desk’s Deadlines tab, a month whose notice is printed and in the mail now draws an amber circle with an envelope, the same circle a Notice on file wears in green, instead of the hollow flag of a notice still owed. It sits beside Notice on file in the key at the bottom.',
    'The month bar says how many of its notices are in the mail, and offers Record the mailing · N beside Draft the N, so a printed notice is never drafted twice. The GC row says “record the mailing” when every notice it owes is printed.',
    'Pressing the envelope on a row, the bar’s button or the key’s door opens the run on its recording step, where the certified numbers go in. Once recorded, the mark turns into Notice on file.',
  ],
}

export default note
