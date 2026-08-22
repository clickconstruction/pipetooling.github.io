import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2059',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Pipeline: the follow-up card slims down',
  highlights: [
    'The "Ask when they\'ll pay" card now matches its neighbors — one-line claim (the badge carries the customer count), one quiet detail line, button.',
    'The tier chips folded into the detail line as plain text: "11 customers past expected, never asked · 1 broken promise · 2 waiting" — only non-zero tiers speak.',
  ],
}

export default note
