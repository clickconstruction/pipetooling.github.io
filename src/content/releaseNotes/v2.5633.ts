import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5633',
  date: '2026-10-19',
  title: 'A bill sent through Stripe shows in the Pipeline row’s activity',
  kind: 'fix',
  highlights: [
    'When a bill goes to the customer, by Stripe’s email or the app’s, the Pipeline row’s activity box now shows it in its place in time: “Bill emailed through Stripe”, with who sent it.',
    'The line carries a small Sent tag instead of a number, so the notes keep their numbers and “check note 3” still means note 3.',
    'Old sends show too: the job’s activity already kept them, the box just did not draw them.',
  ],
}

export default note
