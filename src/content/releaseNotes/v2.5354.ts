import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5354',
  date: '2026-10-12',
  title: 'Messages: the bids@ reader is written, not yet switched on',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every few minutes the app can read the new emails in bids@ and put each one on its sender’s thread, with its files kept and a label added in Gmail.',
    'A copy one of us forwards to bids@ lands on the person who first sent it. Newsletters and notices stay in Gmail.',
    'It stays off until a dev turns it on after a test email from the owner’s phone.',
  ],
}

export default note
