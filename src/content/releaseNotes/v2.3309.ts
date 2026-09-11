import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3309',
  date: '2026-09-11',
  title: 'Pick the GC on the test report\'s send sheet',
  kind: 'feature',
  highlights: [
    'Most pretest jobs carry the homeowner as the customer and no GC, so Send prefilled the homeowner\'s address. The send sheet now has a GC row: search for the contractor who ordered the test, their email fills To, and one checkbox sets them as the GC on the job — so the next report, the Stages board and the portal already know.',
    'A GC with no email on file? Type the address once and a second checkbox saves it on their customer card.',
    'The activity line names the GC when the report went to them.',
  ],
}

export default note
