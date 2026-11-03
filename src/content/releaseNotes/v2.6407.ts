import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6407',
  date: '2026-11-02',
  title: 'The Development page’s Money look gains a Scoreboard: every job’s hours, costs and profit in one grid',
  kind: 'feature',
  roles: ['dev', 'controller', 'master_technician', 'assistant'],
  highlights: [
    'Press Scoreboard at the top of Money. The nine column heads are the site’s totals: hours, days, labor, subs, parts, overhead, earned, cost and profit. Every job is a row under them, the biggest earner first.',
    'A row folds to Earned, Cost and Profit. Press its arrow to open all nine. Press a column head to sort by it, and again to turn the order.',
    'Jobs with nothing on them yet fold under one line. A job with no price that is costing says so. A job with no percent on record earns half its price and wears ≈.',
    'A dev or a controller reads every column. The rest of the office reads hours, days and earned, with no wage and no cost. The page remembers which view you were in.',
  ],
}

export default note
