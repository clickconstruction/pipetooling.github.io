import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4455',
  date: '2026-10-02',
  title: 'Where the checks went: a move and a deposit read their own day',
  kind: 'fix',
  highlights: [
    'A payment moved to another job after 7 pm Central would have read as moved the next day. So would a bank deposit that posted after 7 pm.',
    'Both now read their day on the company’s calendar. That covers Find a check, the printed sheet and its CSV, and the moves under Your payments on the customer portal.',
  ],
}

export default note
