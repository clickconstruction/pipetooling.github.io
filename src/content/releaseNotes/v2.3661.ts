import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3661',
  date: '2026-09-21',
  title: 'Lien desk: months say what their deadline means, and a skipped month stays on the record',
  kind: 'feature',
  highlights: [
    '“Jul · 5.2 h · by Oct 15” is now a card: Jul 2026, 5.2 approved hours, 1 person · 2 days, Mail by Oct 15 · 24 days left — with a line above saying each month of work has its own deadline, and missing it means that month can no longer be liened.',
    'The claim amount the notice states sits beside the months in large type, labelled as what is still unpaid on the job.',
    'New: Earlier months. Months that were sent, skipped or missed show as a row of dots under the cards — click one to see when it was skipped, by whom, the reason typed at the time, and what it meant for the lien right.',
    'From now on a skip records who made the call, not just why.',
  ],
}

export default note
