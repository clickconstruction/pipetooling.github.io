import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2187',
  date: '2026-08-23',
  title: 'Quickfill: one Email section instead of three',
  kind: 'fix',
  highlights: [
    'Email Inbox, Email: Follow Up and Email: Next Actions were the same box three times, each with its own chip and mark. Now one Email section with three rows — Inbox · Follow Up · Next Actions — each with its own "Open" link and note box, and one Mark Email up to date.',
    'The mark still asks what\'s still sitting there (or "clear"); the saved note lists each row you filled in. Two chips leave the jump strip and the dock; Email keeps its history.',
  ],
}

export default note
