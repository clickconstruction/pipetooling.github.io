import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3934',
  date: '2026-09-27',
  title: 'Edit Job: the invoice buttons are their own piece',
  kind: 'fix',
  highlights: [
    'Everything Edit Job does to create an invoice — New Invoice, billing picked stages, “Bill it” on one stage, a bill per payer, a hazmat fee billed separately, and moving a job to Ready to Bill — lived inside the form. It is now one piece of its own, with tests for each button.',
    'Nothing on screen changes.',
  ],
}

export default note
