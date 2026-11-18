import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7846',
  date: '2026-11-18',
  title: 'Lien desk: Filed liens: copies to mail saves everything by itself and shows each lien’s document number',
  kind: 'feature',
  highlights: [
    'The window has no record press now. Ticking Mailed writes the Mailed on day to that lien at once, and unticking takes it back. Numbers and receipts were already kept as you added them.',
    'A mail number ticks Mailed. A file alone does not. A mailed lien stays in the window, under Mailed, until each envelope has its number and its receipt.',
    'Each lien’s card shows its document number, the county, the day filed and the clerk’s stamped lien. Change fixes a number typed wrong, and a lien with no number takes it right there. A number another lien holds is not saved.',
    'The receipt press reads Add the mail receipt. A file that looks like the lien, or the same file on both envelopes, is asked about before anything is saved.',
  ],
}

export default note
