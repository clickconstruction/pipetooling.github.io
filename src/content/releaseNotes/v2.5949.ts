import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5949',
  date: '2026-10-27',
  title: 'The AR call card reads an evening touch on the right day',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant'],
  highlights: [
    'On the Dashboard\'s AR Customers view, a call or note logged after 7 PM Central showed tomorrow\'s date on the customer\'s call card, with no age beside it. It now shows the day it was made, with "today".',
    'The chase pill counts from the right day too. Touched shows today\'s date, a could-not-reach snooze reads "back in 7d" instead of 8, and the three quiet days after a touch end on time.',
  ],
}

export default note
