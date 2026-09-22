import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3711',
  date: '2026-09-22',
  title: 'Day book: a bill sent through Stripe counts for the person who sent it',
  kind: 'fix',
  highlights: [
    'Sending a bill through Stripe now records who sent it on the bill itself, so the Day book’s Billed line credits the person instead of listing the send as “by the system”.',
    'Bills emailed as a PDF carry the sender the same way. Nothing changes in how a bill is sent.',
  ],
}

export default note
