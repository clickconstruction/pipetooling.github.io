import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3498',
  date: '2026-09-16',
  title: 'A bill no longer shows a payment that belongs to a different bill',
  kind: 'fix',
  highlights: [
    'When a job had several bills, a new bill printed the earlier bill’s payment in its payment history and subtracted it again — so a $9,800 bill could tell the customer they owed $1,800, or nothing at all.',
    'A bill now shows only its own payments, plus any payment recorded on the job without a bill attached. Whole-job bills are unchanged.',
    'This is the same invoice that encloses with a demand letter and a lien notice, so those read the true balance now too.',
  ],
}

export default note
