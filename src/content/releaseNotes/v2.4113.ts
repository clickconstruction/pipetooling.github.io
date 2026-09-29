import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4113',
  date: '2026-09-29',
  title: 'Procurement log: Download CSV and Open in Google Sheets beside Print the log',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Download CSV saves the log as a spreadsheet file: one row per item with the printed sheet’s columns (tag, product, house, stage, submittal, released, ordered, PO, lead time, expected and where it came from, required, float, delivered, note), dates written so a spreadsheet reads them.',
    'Open in Google Sheets copies the same rows and opens a new Google Sheet in your browser; click A1 and paste. If the copy is blocked, the toast says to use the CSV instead.',
  ],
}

export default note
