import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2804',
  date: '2026-09-05',
  title: 'The DWC-83 workers’ comp agreement is a form',
  kind: 'feature',
  highlights: [
    'The Texas DWC-83 joint agreement is in the Contract library and the Subs packet. The sub fills and signs Part 3 on their phone; the office completes Parts 1 and 2 from the record and finishes the PDF for filing.',
    'The Form Studio now tells you when a PDF cannot be read and how to re-save it, instead of a bare parser error.',
  ],
}

export default note
