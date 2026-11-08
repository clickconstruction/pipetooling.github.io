import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6683',
  date: '2026-11-08',
  title: 'The Pipeline board reads the customer’s conversation once per load, ready for the row’s activity box',
  kind: 'feature',
  highlights: [
    'Every load of Jobs → Pipeline now reads each job’s newest three calls, texts and emails between you and the customer, in the same slices and at the same moment as the notes and reports it already reads. Nothing is drawn yet: the next release puts the lines in the row’s Job activity box and on the phone card’s teaser.',
    'The read follows the rule Job activity and the speech bubble’s window already use, so the box, the window and Job activity will show the same lines: the lines tied to the job, and while the job is unpaid the customer’s lines not tied to any job yet since it began. A note or a status event is never among them.',
    'The office reads the lines; the rest of the team reads nothing new. A line that lands while the board is open is picked up as the waiting dot is, with no reload.',
  ],
}

export default note
