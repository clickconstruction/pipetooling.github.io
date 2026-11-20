import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8085',
  date: '2026-11-20',
  title: 'Send a paper: a customer search that fails says so',
  kind: 'fix',
  highlights: [
    'In Who is it with?, a customer search that fails now says so with its reason and offers Retry. The team, the subs, the supply houses and Someone not in any list still show under it.',
    'Add to a list does the same under Someone at a company we already have, for the customers and for the supply houses.',
    'Before, a lost signal looked like a customer the app did not have, which invited a duplicate.',
  ],
}

export default note
