import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7609',
  date: '2026-11-17',
  title: 'Sub portal: Got it on a payment, and Something is wrong on a statement or payment',
  kind: 'feature',
  highlights: [
    'On Statements, a sub can tap Got it on a payment. It asks one question and marks the payment received.',
    'A sub can tap Something is wrong on a statement or a payment and send the office a note. Nothing on the statement changes, and neither press is a condition of being paid.',
    'Jobs → Subs → Pay shows a grey Received chip on a payment the sub marked. A note flags the sheet in red until someone presses Mark answered.',
    'A note also lands in the dispatch inbox once the page\'s function is deployed again.',
  ],
}

export default note
