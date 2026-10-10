import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5194',
  date: '2026-10-10',
  title: 'GC mode: everything with a trade partner, in its window',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A trade partner’s window has a new Activity tab: every call, quote, paper and payment with them, newest first.',
    'Filters show one kind at a time, and a line about a job opens that job.',
    'Log a contact records a call, text or email with the company that is not about one quote.',
  ],
}

export default note
