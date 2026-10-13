import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5403',
  date: '2026-10-12',
  title: 'Messages: a line on an estimate from a customer’s message, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for starting an estimate line from a customer’s text are written. The line goes on the job the text is tied to, with their words as the description.',
    'It joins the job’s draft estimate, or starts a new one. It refuses a billed or paid job, a job that is not theirs, and anyone who is not a customer.',
    'Nothing on screen changes yet.',
  ],
}

export default note
