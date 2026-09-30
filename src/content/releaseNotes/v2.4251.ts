import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4251',
  date: '2026-09-30',
  title: 'Procurement log: date boxes read MM/DD, open the calendar on a click, and take a typed 9/23',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The Ordered, Expected and Delivered boxes are now as narrow as a month and a day, like 09/23. The year shows only when the date is in another year, like 09/23/27. The three columns take about half the room they did.',
    'Click a date box and the calendar opens. Pick a day and it saves at once.',
    'Or type the date: 9/23, 09-23 or 0923, then Enter or leave the box. The year is the one nearest today; type 9/23/27 to say another. What does not read as a date is not saved, and a line says so.',
    'On a phone a tap opens the phone’s own date picker, with no keyboard.',
  ],
}

export default note
