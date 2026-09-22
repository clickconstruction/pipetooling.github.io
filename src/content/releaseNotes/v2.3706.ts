import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3706',
  date: '2026-09-22',
  title: 'Contract sweep: the signing ways as one row, and a ⋯ More in the footer',
  kind: 'feature',
  highlights: [
    'How this one gets signed is now one row of three — Email the PDF to sign by hand · Email a signing link · Download to print — with a line underneath saying what the chosen way does. A way that cannot be picked is dimmed and the line says why. A builder’s row shows File their subcontract, with Send ours anyway one tap below.',
    'The footer has one blue button: & next when the row is Ready and another follows, otherwise the one-job send. Preview PDF stays at the left; Open the full editor and the one-job send (while & next is showing) sit under ⋯ More.',
    'Fix email on the job stays in the open on a row with no email — a fix does not hide in a menu.',
  ],
}

export default note
