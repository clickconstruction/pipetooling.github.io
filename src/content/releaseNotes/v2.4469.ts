import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4469',
  date: '2026-10-03',
  title: 'Sub work orders: a signature, an offer or a report in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'On the Work Orders board and the Subs tiles, a work order signed or sent after 7 pm Central showed the next day. A signature on the last evening of a month counted in the next month.',
    'An offer’s waiting days, the sub’s progress report and the last portal visit read that next day too. So did a sheet’s days at the walk-through.',
    'A sheet made in the evening with no date of its own showed the next day in the Sheet date box, on the board and in the Dashboard’s money owed.',
    'The work order panel now shows the day the master agreement was signed, not the day before.',
  ],
}

export default note
