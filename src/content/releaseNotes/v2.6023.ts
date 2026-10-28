import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6023',
  date: '2026-10-28',
  title: 'GC mode: Paste rows into a schedule template from a spreadsheet',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Paste rows on the Templates page, or in the editor, takes a list pasted from a spreadsheet: one row a line, with phase, row, who, days, waits on, gap and milestone between tabs.',
    'The line under the box says how many rows and phases it read, which lines it could not read and why, and which waits name a row nobody is called.',
    'Add N rows puts the rows on the template in their phases, matching a phase the template has by name, with every wait by the name the row has then.',
  ],
}

export default note
