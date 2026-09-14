import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3430',
  date: '2026-09-14',
  title: 'Job accounts: the invoice flag sets itself, and one Needs You card counts the jobs that bought with no account',
  kind: 'feature',
  highlights: [
    'Add Invoice: allocate the job and, if that job has an open job account at this house, “On job account” is already checked with the reference beside it. No account on record? An amber line says so with Mark opened… right there.',
    'Dashboard → Needs You: one card, “N jobs bought parts at a house with no job account”, with the dollars and the houses named. It counts real evidence — an invoice allocated or a PO code minted in the last 180 days at a house that expects an account — and clears itself as accounts are marked opened or not needed.',
    'Jobs → Pipeline: a “No job account · N” chip in the Fix-ups strip; Materials → Job Accounts: a “Bought, no account” filter with the houses named on each row.',
    'The two older cards (“packet on file, unflagged” and “flagged, no packet”) retire into this one; their filters stay on the Job Accounts tab.',
  ],
}

export default note
