import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2145',
  date: '2026-08-23',
  title: 'Quickfill: Jobs Cleanup — unlinked sub labor + today\'s money cards',
  kind: 'feature',
  highlights: [
    'New Quickfill section, right after Missing job info: every sub labor sheet with no job (blank number, or a number that matches no job) — contractor, date, address, total, due — with a Link job button that opens that sheet in Edit Sub Labor, job search one tap away.',
    'Below it, the Pipeline\'s own Today\'s Money Opportunities cards — same numbers, same copy. Each button lands on Jobs → Pipeline with that list or filter already open (Capable list, 90+ filter, Accounts Receivable, no-bill-line filter, GC Review, call mode).',
    'Standard mark button and 12h re-expand; the "N open" count is sheets + cards; empty reads "nothing to clean up".',
  ],
}

export default note
