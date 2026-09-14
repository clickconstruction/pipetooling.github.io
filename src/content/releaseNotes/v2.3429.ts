import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3429',
  date: '2026-09-14',
  title: 'Demand letter: the invoice goes with it as Exhibit A',
  kind: 'feature',
  highlights: [
    'Every demand letter now carries the unpaid invoice behind it as Exhibit A — the bill as the customer received it, stamped, one PDF with the letter. Print and Download PDF produce the whole packet.',
    'When the job has a signed agreement it rides along as Exhibit B, and the dated delivery record (sends, re-sends, calls, promises) as Exhibit C — both by a switch under “Enclosed”.',
    'The preview shows the exhibits as the pages they will be, the letter names them under the statement and in an Enclosures line, and the record on the job keeps what went out and to whom.',
  ],
}

export default note
