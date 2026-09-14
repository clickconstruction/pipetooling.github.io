import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3389',
  date: '2026-09-14',
  title: 'Contract sweep: file a signed copy without leaving the pane, or drop it on the row',
  kind: 'feature',
  highlights: [
    'Already signed? File it (and File their subcontract on a builder’s job) now opens the filing sheet right in the pane — paste the Google Doc link or attach the scan, check who signed and when, Record as signed. The row leaves the queue and the header counts it: “1 filed”.',
    'Drag a PDF or photo of the signed contract onto any row: the row lights up, the sheet opens with the file already in it, and one click records it.',
    'The same sheet lives in the Contract modal, so filing reads the same everywhere.',
  ],
}

export default note
