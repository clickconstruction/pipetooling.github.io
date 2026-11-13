import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7041',
  date: '2026-11-12',
  title: 'Lien affidavit: the note on a notice’s saved copy prints with the notice record',
  kind: 'feature',
  highlights: [
    'The note typed beside a notice’s saved copy now prints on the notice record, in a row under that notice’s copies. That note is where the office writes the USPS receipt and the day of delivery.',
    'The same note is the last line of the delivery record at the top of the copy of the notice, under the line for each envelope.',
    'A notice with no note prints as before. To add one, open the job’s Lien window and press change beside the saved copy under Filings on this job.',
  ],
}

export default note
