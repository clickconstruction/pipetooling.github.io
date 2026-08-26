import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2358',
  date: '2026-08-26',
  title: 'Roadmap Timeline counts days, not tasks',
  kind: 'feature',
  highlights: [
    'Tasks can carry a ⏱ estimate (task card, half-day steps). Timeline slots now size to effort — a 5-day task draws five times wider than a 1-day one.',
    'The forecast counts days of work: "≈212d left · 5.5 days/week done", with the 🎯 flag landing where that math points. Stage rows and wave headers show their day sums.',
    'Nothing to configure and nothing scheduled: unestimated tasks count as an average task, and a roadmap with no estimates behaves exactly as before.',
  ],
}

export default note
