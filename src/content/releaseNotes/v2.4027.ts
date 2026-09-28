import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4027',
  date: '2026-09-28',
  title: 'Edit Job: a discount applied in Bill Customer no longer makes the job save twice',
  kind: 'fix',
  highlights: [
    'When Bill Customer added a discount while Edit Job was open, the form took the new line and then, about a second later, wrote every line item back again unchanged. It now takes the line and writes nothing.',
    'If you had typed something a moment before, it is still saved as before.',
  ],
}

export default note
