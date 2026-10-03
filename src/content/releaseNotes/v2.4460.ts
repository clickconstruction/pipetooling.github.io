import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4460',
  date: '2026-10-02',
  title: 'Pipeline: a bill marked billed in the evening reads that day',
  kind: 'fix',
  highlights: [
    'On the Pipeline, a bill marked billed after 7 pm Central showed the next day. It showed on its bill row, on the BILL line, on the Billed line of its dates and in the printed Billed report.',
    'Its expected pay date counted from that next day too. So did its wait in Payment forecast, in Money waiting, in their emails and on the chase card.',
    'A chase call logged after 7 pm read as the next day, so its snooze ran a day long.',
    'All of them now read the day on the company’s calendar.',
  ],
}

export default note
