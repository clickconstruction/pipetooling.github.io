import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4523',
  date: '2026-10-04',
  title: 'Lien desk: closing a job’s window brings you back to the desk',
  kind: 'fix',
  highlights: [
    'Clicking a job in the Lien desk opens its Lien window. Closing that window, with × or Cancel, now lands you back on the Lien desk. It used to drop you on the Pipeline.',
    'The desk is where you left it: the same tab, the same filter and the same place in the list.',
    'The same goes for Put a GC on notice, and for the doors to a job’s notice and its affidavit.',
  ],
}

export default note
