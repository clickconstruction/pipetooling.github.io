import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2529',
  date: '2026-08-31',
  title: 'Sign-in page headline now reads ClickPlumbing.com',
  kind: 'fix',
  highlights: [
    'The big heading on the sign-in page says "ClickPlumbing.com" (it already linked there), so the crew sees the company web address instead of just the name.',
    'Customer-facing pages (estimate and contract accept) keep the full "Click Plumbing and Electrical" heading.',
  ],
}

export default note
