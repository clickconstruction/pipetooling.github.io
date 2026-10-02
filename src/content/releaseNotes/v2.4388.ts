import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4388',
  date: '2026-10-01',
  title: 'Takeoffs: a new version or a duplicate keeps its stage boxes and Sold in rules',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A new version of a bid now keeps the 1 · 2 · 3 stage boxes on its takeoff. Before, the new version started with none.',
    'A duplicate of a bid keeps them too, and both keep each line\'s Sold in rule.',
    'A bid adopted as a version brings its stage boxes with it.',
    'A duplicate also keeps Sub and per 100 ft labor rows as they were, and the travel numbers.',
  ],
}

export default note
