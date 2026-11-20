import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7976',
  date: '2026-11-19',
  title: 'HR files: an assistant reads the numbers the file gives and keeps a case’s items and log',
  kind: 'infra',
  highlights: [
    'A developer’s assistant now reads each evidence record’s number, such as Ev #41, wherever it reads the record.',
    'It reads a case’s open items by number and the newest lines of its log in the first page it opens on a file.',
    'It can open, change, close or reopen an item and add a log line, after a dry run that shows the number the file would give.',
    'When it plans a new evidence record, the plan says which number the record would take. Nothing changes on People → HR.',
  ],
}

export default note
