import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4463',
  date: '2026-10-02',
  title: 'Deposits: a check posted or bounced in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'A deposit the bank posted after 7 pm Central read as the next day on a payment’s bank line. Use the bank date as the check date would have saved that next day.',
    'A check that came back after 7 pm read as the next day, so its month could read one month late. The new check offered on a bounced check’s case was dated the next day too.',
    'They now read the day on the company’s calendar, as Banking already does.',
  ],
}

export default note
