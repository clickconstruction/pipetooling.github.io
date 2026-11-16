import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7488',
  date: '2026-11-16',
  title: 'Lien desk: the property card shows every job at one property',
  kind: 'feature',
  highlights: [
    'On By job, a job at a property with more than one job has a blue line under its GC, like 412 Ridgeline Dr · 7 jobs here. Press it to open the property card.',
    'The card lists every job at that property on one row each: its months, where its notice stands, where its affidavit stands and what it still owes. One line over the list counts them, like 6 notices sent · 1 to print and mail · 6 at the affidavit.',
    'So when an owner’s envelope holds one job at a property with seven, the card says why: the other six went in earlier envelopes, and it names the days.',
    'Press a notice or an affidavit on the card to open that paper. A job with no property record says so on its By job row, with Set the property beside it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
