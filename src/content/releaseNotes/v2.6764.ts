import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6764',
  date: '2026-11-08',
  title: 'Settings → Bids & materials: the estimators own their copy, catalog, names and cover letter; the owner owns the estimate wording and the Bid Board value rule',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'estimator'],
  highlights: [
    'Estimators now edit Prospect copy, the Line item catalog, the Takeoff, Labor and Price book names, the Counts quick-add names and the Bid cover letter defaults. Before, these were a dev’s.',
    'The owner sees Bids & materials for the Estimate customer experience defaults, the Public estimate terms and the Bid Board value rule.',
    'The owner turns on cost mode on Bids → Estimators and reads the estimator labor table in the board’s health section.',
  ],
}

export default note
