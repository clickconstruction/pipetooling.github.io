import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3261',
  date: '2026-09-11',
  title: 'Overhead reads recorded time: clocked-out sessions count the day they happen, not the day they’re approved',
  kind: 'feature',
  highlights: [
    'The overhead pool and every field-hour figure built on it — People → Overhead, the Dashboard overhead card, Job Summary’s Hours · days, overhead, Days, Timeline and Capacity, and the Burn projection — now count recorded time: closed sessions that are not rejected or revoked, approved or still awaiting approval. The same rule job labor has used since September 8.',
    'The last two weeks stop reading light. Office and bid time shows in the pool the day it’s clocked; a rejection removes it. Payroll is unchanged and still pays approved time only.',
    'Pending approvals is now a review queue, not a missing-money warning: the Overhead tab’s maintenance card and Job Summary’s chip say the hours are already counted and that rejecting a bad punch is what removes them.',
  ],
}

export default note
