import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4385',
  date: '2026-10-01',
  title: 'Pricing: two versions get their own ★ price back',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On BP385, Written to Plan’s ★ is its own price again, not Value Engineered’s. On BP384, NORTHSTAR’s ★ is its own WENDI price, not PlanHub’s.',
    'Each now stars the price its cover letter already showed, so nothing the GC sees changes. The map and the other GC packets now agree with it.',
  ],
}

export default note
