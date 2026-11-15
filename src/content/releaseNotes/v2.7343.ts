import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7343',
  date: '2026-11-15',
  title: 'Pay calendar: terms can be a number of days after the bill',
  kind: 'feature',
  highlights: [
    'The pay calendar window now asks How they pay first: on a set day of the month, or a number of days after the bill.',
    'Pick the number of days and type it, like 45. A bill is then due that many days after they accept it. No cutoff applies.',
    'It works for a customer and for one job on its own terms. Rows read Paid 45 days after the bill.',
    'An estimator’s pay terms on a won bid offer the same choice.',
  ],
}

export default note
