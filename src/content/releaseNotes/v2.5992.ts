import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5992',
  date: '2026-10-27',
  title: 'Extend a sent estimate’s good-through date',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'estimator', 'superintendent', 'dev'],
  highlights: [
    'A sent estimate now shows Good through with its date, and “passed” beside it once the day is behind you. Under Waiting for customer, a date field with +2 weeks, +30 days and +60 days and one press, Extend good-through to <day>, moves the date.',
    'The link the customer already has keeps working, and every copy of it: a city that passed the link around keeps every one. Nothing is re-sent unless you press Resend link.',
    'Customer activity records the line, “Good-through date extended to Nov 26, 2026 by Taunya”, with the old date. The sent chip keeps counting from the first send.',
    'The words for an expired estimate now point at Extend instead of a new estimate. Resend link comes back the moment the date is good again.',
  ],
}

export default note
