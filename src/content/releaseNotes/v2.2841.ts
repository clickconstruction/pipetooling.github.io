import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2841',
  date: '2026-09-05',
  title: 'Banking: User Sort loads every transaction, and Link… can no longer erase splits',
  kind: 'fix',
  highlights: [
    'Banking → User Sort and Ledger now load every transaction in the window instead of silently stopping at the first 1,000. The "Without person / Not split to jobs / N of N loaded" line counts the whole table, and the ⚠ capped chip only appears at the real 15,000 ceiling.',
    'The Person and Jobs columns are complete: every split and every person link is loaded, so a transaction that was already split no longer shows as "Not split".',
    'The Link to person and jobs window reads the transaction\'s current splits and person the moment it opens, and checks again right before saving. If someone else saved in between, it refuses and offers Reload — nothing is overwritten.',
    'Accounting → Approvals and the Sorting Ledger labels load completely too, past the same 1,000-row limit.',
  ],
}

export default note
