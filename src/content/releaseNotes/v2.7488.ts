import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7488',
  date: '2026-11-16',
  title: 'Lien desk: the property card shows every job at one property',
  kind: 'feature',
  highlights: [
    'On By job, a job at a property with more than one job has a blue line under its GC, like 412 Ridgeline Dr · 7 jobs here. Press it to open the property card.',
    'The card lists every job at that property on one row each: its months, where its notice stands, where its affidavit stands and what it still owes. Two lines over the list count the papers, each kind apart: the notices, like 4 notices sent Oct 14 · 2 on Sep 22 · 1 to print and mail, then the liens, like 6 lien affidavits ready to file.',
    'So when an owner’s envelope holds one job at a property with seven, the card says why: the other six went in earlier envelopes, and it names the days.',
    'Press a notice or an affidavit on the card to open that paper. By job itself now reads an approved affidavit as approved, where it used to say Draft the affidavit.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
