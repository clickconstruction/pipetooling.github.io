import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4465',
  date: '2026-10-02',
  title: 'Legal: an evening call or bill keeps its day, and stays with the office',
  kind: 'fix',
  highlights: [
    'On the Legal desk, a bill, a collection call, a promise or a contact logged after 7 pm Central read as the next day. The packet’s ledger, its timeline and the account’s age all used that next day.',
    'A call or promise logged the evening before the first bill could read as the bill’s own day. It then went to the firm by default, when it should have stayed with the office.',
    'The desk and the firm’s page now read every day on the company’s calendar, so they agree on what stays with the office.',
  ],
}

export default note
