import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4321',
  date: '2026-10-01',
  title: 'Lien desk: the Calendar loads its jobs on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, the Lien desk’s Calendar said 0 jobs and “Nothing billed is on a lien clock.” until the Billed stage had been opened. Opening the desk now loads the billed jobs itself, so the Calendar shows all of them with the to-do and the column cards.',
    'While those jobs load, the Calendar says “Reading the board…” instead of counting 0 jobs.',
    'A computer with the job map hidden and the Billed section folded had the same gap. It is fixed the same way.',
  ],
}

export default note
