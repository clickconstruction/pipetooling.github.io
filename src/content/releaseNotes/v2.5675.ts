import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5675',
  date: '2026-10-20',
  title: 'The aging window’s Job acct chip is an act, not just a mark',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'In an aging cell’s invoice window, the Job acct chip now presses: one tap puts an invoice on the job account when the job’s account at that house is open, and Job acct ✓ taps off.',
    'With no account on record, an amber note unfolds under the row with the invoice form’s own words — Mark opened… (the same two-tap sheet) or Flag anyway.',
    'Saving the sheet as open flags the invoice too, and the teal job-account lines under the cells re-sum everywhere at once.',
    'A split invoice says so instead of offering the chip — job accounts are per property.',
  ],
}

export default note
