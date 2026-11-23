import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8302',
  date: '2026-11-22',
  title: 'Customers: a Permits tab on the customer’s page',
  kind: 'feature',
  highlights: [
    'A customer’s page has a Permits tab for the office and estimators. It lists the jobs you priced for them and what the city has on each address, the same block a bid’s window shows under the GC.',
    'The names on permits tied to the customer are on that tab now, with Take back and Find their names on permits. Profile keeps a Names on permits line where the card stood, and it opens the tab.',
    'When two customer rows carry one name, the tab reads them together and says so.',
    'On a phone the page’s tabs slide sideways as one row, so the fifth tab is never cut off.',
  ],
}

export default note
