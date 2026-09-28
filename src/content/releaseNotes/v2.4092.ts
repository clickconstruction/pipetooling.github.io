import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4092',
  date: '2026-09-28',
  title: 'Write up a change: it tells you when you already sent one for this job today',
  kind: 'feature',
  highlights: [
    'On the Ready to send screen, if you already sent a write-up to Dispatch for the same job today, an amber line says so with the time (and the estimate number).',
    'Nothing is blocked — send again if it is different work; otherwise the office already has it.',
  ],
}

export default note
