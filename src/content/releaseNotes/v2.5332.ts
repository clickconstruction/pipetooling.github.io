import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5332',
  date: '2026-10-12',
  title: 'Follow up: see who needs a reminder on their steps',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Follow up has a new list, Nudges from the flow, below We owe them.',
    'It shows each person who is slow on a step, worst first, and why.',
    'Text, call or email them from the row, or hold the row until Monday.',
    'Remind now marks a reminder you sent another way, so the app sends no second one.',
  ],
}

export default note
