import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8427',
  date: '2026-11-23',
  title: 'Bills sent: a send whose bill was taken back says so',
  kind: 'fix',
  highlights: [
    'A bill that went out and was later taken back or replaced still shows its send. That line had no amount and no word on payment, with nothing to say why.',
    'The line now reads: This bill is no longer on the job. It was taken back or replaced after it went.',
  ],
}

export default note
