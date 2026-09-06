import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2912',
  date: '2026-09-05',
  title: 'Crew P&L: real rows first, one person per row, and cached figures say so',
  kind: 'fix',
  highlights: [
    'Rows whose billing is mostly an equal-split guess (a job with revenue but nobody clocked on it) now carry an "≈ estimated" tag and sort below the real rows in every numeric sort — Profit, $/hr, Hours — in both directions, with a divider at the seam. The top of the table is the hours-weighted answer again.',
    'A free-text spelling on a sub sheet or session ("Garcia, Jose", "J. Garcia", missing accents) now lands in the roster person\'s row when only one person can match, so one crew member is one row. When two people could match, the "unmatched" tag stays and its tooltip says how to fix it.',
    'If the complete job list fails to load, the tab says "Showing cached figures from <time> — the complete job list didn\'t load…" with a Refresh button instead of quietly showing numbers with paid jobs missing; while it loads, a small line says the figures come from the page cache.',
  ],
}

export default note
