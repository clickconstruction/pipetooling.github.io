import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2870',
  date: '2026-09-05',
  title: 'Totals count every row: Banking Visuals & Accounting, customer money chips, Bridge, job card charges',
  kind: 'fix',
  highlights: [
    'Several whole-company reads used to stop quietly at 1,000 rows and present the partial sum as the total. They now page through everything: Banking → Visuals (transactions and their labels), Banking → Accounting ("used N×" rule counts and the retroactive-attribution offer), the PAID / BILLED / UNBILLED chips and "Total open balance" on Customers, Dispatch Mode\'s customer job counts, the HCP payment backfill, the Jobs stages header, and every Bridge day total.',
    'Job Summary card charges follow one rule everywhere: the per-job detail rows, the print/PDF breakdown, and the total shown right after saving a split now exclude Internal Transfers and mark invoice-linked charges exactly like the job list does — the detail can no longer sum to a different number than the card.',
    'Banking → Visuals\' "Showing the most recent 15,000 transactions" note now appears only when that ceiling is really reached.',
  ],
}

export default note
