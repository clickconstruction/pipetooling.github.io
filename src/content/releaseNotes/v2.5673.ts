import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5673',
  date: '2026-10-20',
  title: 'Accounts payable: an aging cell opens onto the invoices behind it',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On Materials → Supply Houses, every money cell of the aging table is now a door: press a house\'s 60–90 cell and a window lists exactly the invoices it sums — number, PO, dates, a past-due chip, the jobs, the scan link.',
    'The Total row opens the same window across every house, grouped; the Owed cell is the house\'s whole unpaid book; Credits open lists the memos with their pairing lines.',
    'The window\'s bottom line always equals the cell, and with Mark job-account invoices on it also says how much of it sits on the house\'s job account.',
    'Open house at the bottom jumps to the house\'s own invoices. Row clicks still open the house; a dash stays a dash.',
  ],
}

export default note
