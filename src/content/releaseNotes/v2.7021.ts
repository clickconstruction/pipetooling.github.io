import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7021',
  date: '2026-11-12',
  title: 'Lien affidavit: a notice record and a copy of each notice print with the paper',
  kind: 'feature',
  highlights: [
    'A lien affidavit printed for the notary now has a notice record in front of it. It lists each § 53.056 notice on the job, with the day, the method and the certified mail number of each copy.',
    'The record reads the paper’s months and notice days against what is on the job. It lists what is missing, such as a mail number or a copy to the original contractor, and says where to add it.',
    'Behind the record prints a copy of each notice. Its delivery record is at the top, with a big check and how many days ago it went. None of these pages is filed with the clerk or kept as the job’s saved copy.',
    'Print the notice record is a new box beside the print press. The Lien desk’s batch print has a block for each paper, and Add a copy of each notice starts unticked there. The help sheet is back on one sheet.',
  ],
}

export default note
