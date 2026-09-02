import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2642',
  date: '2026-09-02',
  title: 'Price requests: plans attached, silence sorted to the top',
  kind: 'feature',
  highlights: [
    'Sending price requests can now include the job plans link — vendors open cut sheets before pricing fixtures, and the same link rides the email, reminders, and the quote page.',
    'The request desk now sorts by what needs you: bounced addresses first, then requests whose needed-by is closing in, then ones nobody has opened in two days — each with a plain-words reason chip.',
  ],
}

export default note
