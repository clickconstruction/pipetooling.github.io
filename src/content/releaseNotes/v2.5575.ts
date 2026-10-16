import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5575',
  date: '2026-10-16',
  title: 'Training: the card says the size of a course, the page counts lessons and the final check apart, and a pass says the day',
  kind: 'fix',
  roles: ['helpers', 'subcontractor', 'primary', 'master_technician', 'superintendent', 'dev'],
  highlights: [
    'The Dashboard card says how big a course is before the first press: 30 lessons of about five minutes, about 3 hours in all. Once started it says how many lessons are done.',
    'The course page counts lessons and the final check apart: 12 of 30 lessons, and a green Final check passed chip once it is. The red Not done yet chip waits until there is a pass to date.',
    'A passed final check says the day it is due again and offers Back to the Dashboard beside Read a lesson again.',
    'Each question in a check is a box with the question as its heading. On a phone every answer row, lesson row and press is a full finger tall.',
  ],
}

export default note
