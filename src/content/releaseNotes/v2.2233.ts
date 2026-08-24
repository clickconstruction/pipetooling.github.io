import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2233',
  date: '2026-08-24',
  title: 'Pay speeds breakdown shows the payments behind each median',
  kind: 'feature',
  highlights: [
    'Click any customer in the Pay speeds breakdown to see their actual payments — billed date, the day money hit, and the days in between, like (+16) 05/01–05/17.',
    'Each gap is color-coded against the company median: green at or under it, amber above, red at twice it or more — slow payments jump out.',
    'Thin-history customers show their 1–2 payments too, and customers with none say why: no invoice-linked payments in the last 12 months.',
  ],
}

export default note
