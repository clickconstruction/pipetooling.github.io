import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5793',
  date: '2026-10-23',
  title: 'Messages: one Who is this? on a New row, beside the name',
  kind: 'fix',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'A row in New said Who is this? twice: a chip beside the name and a button under the words, both opening the same card. The row keeps one now, a small blue pill beside the name that reads the question the card answers: Who is this?, Which job? or Who has it?.',
    'The pill opens the thread at the sort card, as pressing the row does. Nothing repeats it under the words, so the row reads name, how it came in, what they wrote.',
  ],
}

export default note
