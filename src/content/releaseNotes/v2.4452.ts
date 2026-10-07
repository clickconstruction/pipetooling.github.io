import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4452',
  date: '2026-10-02',
  title: 'Procurement log: an answer recorded in the evening reads that day',
  kind: 'fix',
  highlights: [
    'On Bids → Submittals, a GC answer recorded after 7 pm Central showed the next day on the procurement log. An approval given on 10/02 read “released 10/03”.',
    'Every answer now reads its day on the company’s calendar. That covers the Released and Submittal dates, the GC’s copy, the printed sheet and the update text.',
    'The date of the last update reads the same way, on the log and on the GC’s review page.',
  ],
}

export default note
