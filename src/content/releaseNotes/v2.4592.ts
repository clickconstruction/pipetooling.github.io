import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4592',
  date: '2026-10-05',
  title: 'Procurement log: a calendar beside the orders',
  kind: 'feature',
  highlights: [
    'To order now has a calendar beside the orders. A blue diamond is the day to order by. It turns amber within three days and red once past.',
    'An order on its way is a blue bar from the day you ordered to the day it lands. The bar turns red past the day the job needs it.',
    'A fixture waiting on the GC shows an open diamond on the day they must answer by. A dark tick marks the day the job needs each order.',
    'The calendar appears once a part has a lead time and the job has stage dates. Until then the log says "No dates to draw yet."',
  ],
}

export default note
