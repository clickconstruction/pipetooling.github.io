import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2881',
  date: '2026-09-05',
  title: 'GC statements: the office sees every scheduled send, duplicates are skipped, and each GC shows what went out',
  kind: 'feature',
  highlights: [
    'GC Review\'s "Scheduled statement sends" box now shows every scheduled send to the whole office — not just your own. You see who set each one up; only that person (or a dev) gets its Cancel button.',
    'A statement that already went to the same address minutes ago is not sent again: Draft Message says so instead of sending (10-minute window), and a scheduled send that would repeat one from the same half-day is skipped with the reason on its row (its weekly chain still advances).',
    'Click a GC\'s last-sent or temperature pill for "What went out": every statement on record in one list — personal-round marks and app-sent emails alike — each with its lane (Personal · text, Draft Message, Scheduled send), who, the recipient, the total, and whether it was delivered.',
  ],
}

export default note
