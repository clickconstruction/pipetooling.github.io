import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6849',
  date: '2026-11-10',
  title: 'Lien desk: a property says what a lien can still cover, what it cannot, and the whole amount owed',
  kind: 'feature',
  highlights: [
    'On the Deadlines tab, a property with a closed window now reads both piles and their sum on its heading, like Lien open on 5 jobs · $13,439 · lien gone on 3 · $4,608 · $18,047 owed here.',
    'Before, the GC’s total counted only the jobs a lien can still cover, so the desk read less than the property owed and did not say why.',
    'Each lien gone row has a new press, Worked later? It opens the job’s Lien window with the last day of work ready to change. A later day can put the job back on the lien.',
    'The phone shows the same line under the address and the same press on the row.',
  ],
}

export default note
