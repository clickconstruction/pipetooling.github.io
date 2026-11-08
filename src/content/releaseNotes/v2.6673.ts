import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6673',
  date: '2026-11-07',
  title: 'Materials on site: the missing money reads the parts book’s price, with the day it was checked',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On Jobs → Materials, a part that came up short or could not be found is now priced from the parts book: the supply house’s latest price, with the day that price was last checked drawn beside the money. The desk’s Missing this week column, the flow row’s red badge and the Job window’s Materials tab read the same price.',
    'A book price checked more than 90 days ago is marked amber with its age. Where the office typed a price off the invoice that landed the part, that price stands in for a stale or missing book price and reads invoice price.',
    'A part typed on site by name has no page in the parts book, so it keeps the invoice price or reads no price, as before.',
    'The guide for the materials desk says which price the money uses and when the invoice’s wins.',
  ],
}

export default note
