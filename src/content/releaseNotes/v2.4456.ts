import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4456',
  date: '2026-10-02',
  title: 'Customer portal: a bill, a notice and a waiver read their own day',
  kind: 'fix',
  highlights: [
    'On a customer’s portal, a bill marked billed after 7 pm Central read as billed the next day. That showed on the bill list and on a bill shared with the other party.',
    'A lien waiver signed or sent after 7 pm read the same way. So did the day of a notice the office recorded then with no mailing date.',
    'Each now reads its day on the company’s calendar.',
  ],
}

export default note
