import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1932',
  date: '2026-08-20',
  title: 'Section totals update immediately when you move money',
  kind: 'fix',
  highlights: [
    'Marking a bill paid, billing a customer, flagging Collections, or sending a job back moved the row instantly — but the section header amounts (and the money story cards) could keep the old numbers for up to a minute. They now refresh the moment the move lands.',
  ],
}

export default note
