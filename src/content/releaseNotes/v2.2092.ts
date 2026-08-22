import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2092',
  date: '2026-08-22',
  kind: 'feature',
  title: 'Why we lost speaks the same language as Waiting to hear',
  highlights: [
    'The header now tells the whole story in one line — how many lost bids need a reason, the dollars unexplained, and both loss rates — and a plain sentence underneath explains how the queue works (the cryptic corner caption is gone).',
    'Search arrives: find a lost bid by bid #, project name, GC/Builder, or address mid-call — the red count keeps counting the whole queue while you look.',
    'The builder list scrolls on its own instead of stretching the page, finished builders say "all explained," and the panel counts what\'s left ("12 of 14 need a reason") instead of what\'s done.',
    'The bid card is now the one white thing on the panel, the pill row says "Their lost bids," and the six reason chips sit under their question — "Why did we lose it?" — with the keyboard hint right beside it.',
  ],
}

export default note
