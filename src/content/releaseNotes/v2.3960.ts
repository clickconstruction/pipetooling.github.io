import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3960',
  date: '2026-09-27',
  title: 'GC Review: a broken promise turns red and comes first',
  kind: 'feature',
  highlights: [
    'When a GC gave a pay date and it has passed with money still owed, GC Review says so in red: “promised Sep 20 — 7 days late”. Before, the pay-by chip stayed green after the date went by.',
    'Those GCs sort to the top of their group in This week’s GCs, and the panel counts them.',
    'The same rule shows on the GC’s header and in the Temperature board’s pay date column. The day itself is not late — only the day after.',
  ],
}

export default note
