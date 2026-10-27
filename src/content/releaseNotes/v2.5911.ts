import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5911',
  date: '2026-10-26',
  title: 'An empty list names the next press',
  kind: 'feature',
  highlights: [
    'When a list has nothing in it, it now says what fills it and offers the press: No bids yet. New Bid adds the first. A search with no match quotes what you typed and offers Clear the search.',
    'The nine Bids pickers (RFI, Change order, Lien release, Cover letter, Counts, Labor, Pricing, Takeoff, Submittals) all read the same way, and Only my bids hiding every bid offers Show every bid.',
    'Banking\'s Ledger and Sorting tables, People → Hours\' four session lists and the Dashboard\'s My team ledger say the same: Clear the search, Refresh from Mercury, Last week, Show everyone, or Nothing waiting on you where empty is the good state.',
    'Prospects\' empty lane and the Lien desk\'s empty piles keep their words and now share the one shape.',
  ],
}

export default note
