import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2417',
  date: '2026-08-28',
  title: 'Last-contact bookkeeping fully hands-off',
  kind: 'fix',
  highlights: [
    'Every surface that logs a bid note or call now lets the database derive Last Contact from the entry itself — nine hand-written stamps removed.',
    'Fixes the leftover cases where saving a plain note (no call/email/text) could still move a bid\'s contact clock past the real last conversation.',
  ],
}

export default note
