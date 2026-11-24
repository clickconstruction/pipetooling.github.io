import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8447',
  date: '2026-11-24',
  title: 'Bills sent: the list’s spreadsheet file is named for its chip',
  kind: 'fix',
  highlights: [
    'Download CSV on By day sent now names the file for the chip it was saved under, like bills-sent-2026-11-24-not-paid.csv.',
    'A file saved with a search typed ends in search. Before, every file took the whole list’s name, whatever it held.',
  ],
}

export default note
