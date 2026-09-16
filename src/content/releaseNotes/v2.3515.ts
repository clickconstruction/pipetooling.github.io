import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3515',
  date: '2026-09-16',
  title: 'The demand letter counts a paid-down bill, and the theft-of-services line knows when a job has been paid',
  kind: 'fix',
  highlights: [
    'On a job with one bill, a payment recorded on the job without a bill attached now counts in the demand letter — the letter no longer says “Nothing has been paid” above an enclosed invoice that shows the payment and a smaller balance.',
    'The theft-of-services (§ 31.04) line in Lien instruments now reads “not applicable” whenever anything has been paid on the job, on any bill — a partial payment defeats it, per the owner’s rule.',
    'Jobs with several bills are unchanged: a payment not attached to a bill is not guessed onto one. That rule is still the owner’s to set.',
  ],
}

export default note
