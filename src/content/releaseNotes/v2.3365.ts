import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3365',
  date: '2026-09-12',
  title: 'Customers opens in under a second',
  kind: 'feature',
  highlights: [
    'The customer list appears as soon as the customers themselves have loaded — about half a second — instead of waiting behind the counts and money for every row.',
    'The counts, the "owes" money, and the activity chips now arrive in one request instead of fifty-five, so they land right behind the list rather than several seconds later. On a phone the difference is bigger still.',
    'While they are on their way the summary strip shows a small "…" instead of a wrong zero.',
  ],
}

export default note
