import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7545',
  date: '2026-11-16',
  title: 'Checklist: close a task that no longer applies',
  kind: 'feature',
  highlights: [
    'Under ⋯ More, No longer applies closes a one-time task without doing it. Press a reason or type your own.',
    'The task leaves your list and reads "Closed … as no longer applying" with the reason. History and Review mark it the same way.',
    'The person who gave the task gets a message and can put it back. A roadmap task or a vehicle task cannot be closed this way.',
  ],
}

export default note
