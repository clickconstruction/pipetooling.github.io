import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3451',
  date: '2026-09-14',
  title: 'Estimators open job accounts at the win moment',
  kind: 'feature',
  highlights: [
    'When an estimator opens the job from a won bid, the Job accounts question opens for them too — the houses that quoted the bid first and already picked — with Send to Dispatch, None needed, and a new lane: Ask the rep by email.',
    'Ask the rep by email composes the note from the bid — the property, our company, the GC and the contact you submitted to, the start date — and opens it in your own mail client addressed to the house’s job-accounts rep. Sent — log it marks the house requested on the job.',
    'A won bid’s Job block now shows the job’s accounts per house (Ferguson ✓ · Reece requested · Moore none yet · quoted) with a Job accounts… door back to the question. Estimators may mark an account opened on jobs opened from a bid.',
    'The office keeps the money side: invoices, balances and the Job Accounts view do not change.',
  ],
}

export default note
