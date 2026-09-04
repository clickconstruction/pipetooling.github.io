import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2781',
  date: '2026-09-04',
  kind: 'feature',
  title: 'Takeoffs New 2: the sheet, plus what Pricing sees',
  highlights: [
    'Pick New 2 beside the bid name: the familiar sheet, now with the book\'s suggestion inline on every empty fixture and All / Uncosted / $0 filters, beside a rail that shows the exact materials total Pricing will use and which fixtures would show up there as "No Takeoffs cost".',
    'Parts with no catalog price queue up under Needs a price with a one-click quote request; earlier bids that costed the same fixtures offer to fill the uncosted ones, re-priced at today\'s lowest.',
    'New 1 and New 2 hop to each other; Old is unchanged and still the default.',
  ],
}

export default note
