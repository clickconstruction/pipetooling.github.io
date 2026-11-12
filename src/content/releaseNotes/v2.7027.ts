import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7027',
  date: '2026-11-12',
  title: 'Messages: old mail you tag onto a job is filed for the record',
  kind: 'feature',
  highlights: [
    'A mail more than 14 days old when it is tagged from your own mail is filed for the record. It lands on the thread and the job at its own date.',
    'Filed mail asks nobody for a reply. It stays out of New and off the badge, and its line wears a small chip such as filed Nov 9.',
    'A thread with nothing else on it says Nothing waits. A new mail in the same conversation still opens the thread.',
    'Reopen in the thread’s ⋯ menu puts an old conversation on Follow up after all.',
  ],
}

export default note
