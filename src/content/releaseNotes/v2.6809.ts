import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6809',
  date: '2026-11-09',
  title: "The lien affidavit you print carries the dates of the work and the contractor's address",
  kind: 'fix',
  highlights: [
    'The Lien desk showed the affidavit with the dates of the work. One press later, the Mechanic\'s lien tab in the job\'s Lien window printed "from — through —" for a job with no clock hours. The tab now prints the same dates the desk shows.',
    "The same tab left the original contractor's address off the paper. It now prints the address on file for the GC, as the desk does.",
    'The two are one paper now. The window fills the affidavit by the desk\'s own recipe, so they cannot drift apart again.',
    'A job with no clock hours states its last work month, first day to last. Press "change ›" under Last work to set the real last day before you print.',
  ],
}

export default note
