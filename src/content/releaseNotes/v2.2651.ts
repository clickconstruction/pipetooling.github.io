import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2651',
  date: '2026-09-02',
  title: 'Plug in quotes: drop the vendor\'s file',
  kind: 'feature',
  highlights: [
    'The Plug in quotes screen now takes the vendor\'s spreadsheet or PDF directly — drop it in, the text lands in the paste box for you to see, and the matching runs like always.',
    'Spreadsheets with both unit and extended price columns are handled safely: the extended column is dropped automatically so a $742 line total can never masquerade as a $185.50 unit price.',
    'Scanned image PDFs get a straight answer — "no readable text, copy/paste for now" — instead of garbage.',
  ],
}

export default note
