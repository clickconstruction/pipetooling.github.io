import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8086',
  date: '2026-11-20',
  title: 'Dashboard, Needs you: a ZZ test job no longer owes the office answers',
  kind: 'fix',
  highlights: [
    'The line that says a customer owes us answers before a stage now leaves ZZ test jobs out.',
    'A test job from a walk had put that line on the office’s Dashboard. It is gone.',
    'A dev who has chosen to show ZZ test jobs still sees them counted.',
  ],
}

export default note
