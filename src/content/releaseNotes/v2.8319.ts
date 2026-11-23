import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8319',
  date: '2026-11-23',
  title: 'Every write-down of a bill shows on the job’s activity',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'A job’s activity showed only the first time a bill was written down. A second or third write-down left no line.',
    'Now every write-down has its own line, with the amount before, the amount after and the note.',
    'A write-down made on a Stripe bill now names the person who made it.',
  ],
}

export default note
