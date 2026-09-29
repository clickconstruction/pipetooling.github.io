import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4101',
  date: '2026-09-28',
  title: 'Lien desk: a Calendar tab — every billed job on its lien clock, grouped by GC',
  kind: 'feature',
  highlights: [
    'The Lien desk opens on a new first tab, Calendar: every Billed and Collections job with the same runway its Pipeline row carries, grouped by GC — a notice goes to the owner and the GC, and one GC\'s jobs share a run. Each group says its next move and what it is owed: "send 3 notices · 17 d · $41,200".',
    'Direct homeowner jobs, which the notice piles never listed, sit under their own heading with the affidavit clock. Jobs whose window closed unsent sit under "Lien gone", closed by default.',
    'Search by job number, name, customer, GC or address. A row opens the job\'s Lien window. The Pipeline\'s ⋯ menu and the Collections header open the desk on the Calendar; the notices card and the Dashboard\'s doors still land where they say.',
    'This is the shell. Next: the rows on one shared time axis with the 15ths as columns, a count of what lands on each, a key for every mark, and the pay dot you can set in place.',
  ],
}

export default note
