import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3906',
  date: '2026-09-27',
  title: 'Record payment: the math has tests',
  kind: 'fix',
  highlights: [
    'What is left on a pay report, how much of a typed amount is applied, and how much spills over into an employee credit are worked out in one tested place instead of eight.',
    'Nothing on screen changes.',
  ],
}

export default note
