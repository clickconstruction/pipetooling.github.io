import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2531',
  date: '2026-08-31',
  title: 'Robot tab count is now a red badge like the other inboxes',
  kind: 'fix',
  highlights: [
    'The pending-audit count on the 🤖 tab now shows as the same small red badge Unsent/Working uses, instead of text next to the icon.',
    'Same rule as the other badges: it only appears when audits are waiting, and caps at 9+.',
  ],
}

export default note
