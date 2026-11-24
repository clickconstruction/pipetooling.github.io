import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8534',
  date: '2026-11-24',
  title: 'A job’s paper built from settings is reminded by email like any other',
  kind: 'fix',
  highlights: [
    'A paper a job requires can be built from the job’s settings, with no words of its own.',
    'Such a paper took a first reminder date when it was sent, and the hourly reminder then dropped it as a paper with nothing to sign.',
    'The reminder now reads the job’s settings the way the send does, so the paper gets its three reminders.',
    'This matters only while Paper reminders by email is on in Settings. It is off today.',
  ],
}

export default note
