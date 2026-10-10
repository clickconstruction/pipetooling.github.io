import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5205',
  date: '2026-10-10',
  title: 'GC mode: a customer’s calls and everything with them, in their window',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A GC customer’s window has a new Activity tab: our calls with them, bids, signatures, newest first.',
    'Log a contact records a call, text or email with the customer. A line is never changed once it is in.',
    'The schedule’s call list shows the last thing said with a customer too.',
  ],
}

export default note
