import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6149',
  date: '2026-10-30',
  title: 'The portal’s pay-by promise drawn on the bill’s row (punch list #217, a prototype)',
  kind: 'feature',
  highlights: [
    'A prototype of the customer portal draws the pay-by date on the bill’s own row as a small strip of days: the day we billed, today, the customer’s day, and the day we call if the money has not come. The sentence You told us to expect payment by … becomes what the strip shows.',
    'The day we call comes from the office’s own rule, the Payment Chase queue’s grace after a promise, so the customer sees the same day the office works to.',
    'The Changed? chips and Tell us sit under the first bill’s strip, so the customer still moves their day with one tap and no sign-in.',
    'Nothing changes for customers: the strip draws only when the page address carries shape=1. In Settings, under What customers see, the Portal step has a Side by side press that opens today’s look above the strip on the sample.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
}

export default note
