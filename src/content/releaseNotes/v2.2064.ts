import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2064',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal modal: statement-mirror rows, pay links, bigger preview',
  highlights: [
    '"Jobs on this statement" now mirrors the statement exactly — one row per bill, same order, with dates.',
    'Each row carries Pay ↗ (the bill\'s Stripe pay page, when it has one) beside Edit ↗.',
    'The live preview gains ⤢ Expand (grow it in place) and Full screen ↗ (open the portal in a new tab).',
  ],
}

export default note
