import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4462',
  date: '2026-10-02',
  title: 'Lien waivers: a waiver signed or sent in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'A lien waiver issued, asked for, signed or sent after 7 pm Central showed the next day. It showed on the waiver’s chip on the bill, in the waiver window and in the Dashboard’s queue of unconditional waivers owed.',
    'A new waiver’s through date started from the next day too when the last bill was marked billed in the evening.',
    'They now read the day on the company’s calendar.',
  ],
}

export default note
