import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4008',
  date: '2026-09-28',
  title: 'Edit Job: “Remove payment?” no longer tells you to press Save',
  kind: 'fix',
  highlights: [
    'Removing a payment line you had only just typed said to “click Save on the job”. Edit Job has had no Save button since it started saving by itself. The window now says what happens: the line leaves the form, and the job saves the change in a moment.',
  ],
}

export default note
