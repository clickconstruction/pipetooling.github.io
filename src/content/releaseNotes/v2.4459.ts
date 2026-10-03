import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4459',
  date: '2026-10-02',
  title: 'Customer profile: a bill marked billed in the evening counts from that day',
  kind: 'fix',
  highlights: [
    'On a customer’s profile, a bill marked billed after 7 pm Central counted from the next day. Its wait to be paid, behind “pays in about N days”, came out one day short.',
    'A job with an open bill and no estimated bill date also showed its bill date one day late, and its age one day short.',
    'Both now read the day on the company’s calendar.',
  ],
}

export default note
