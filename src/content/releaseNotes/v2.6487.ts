import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6487',
  date: '2026-11-04',
  title: 'A STOP number’s reply box says why, Fold closes the roster, a new search clears the old failure, and the Dispatch badge counts a crew apart',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone or a short laptop, a text to a number that sent STOP keeps the reply box whole, so the line that says the app will not text it stays in view under the field.',
    'On a folded sort card, Fold takes Which of ours? back to one row too, instead of leaving the roster open until Back.',
    'On the Pipeline, typing on after a search that could not reach the other jobs starts the new term clean: the old “Only the jobs already on the board were searched” line and the Paid in Full header’s “not searched” come off until the new lookup answers.',
    'The Dispatch Mode Inbox badge names a stopped crew’s stage check as a crew waiting, apart from the customers waiting, instead of calling it a customer. It still breathes.',
  ],
}

export default note
