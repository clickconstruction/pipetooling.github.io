import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2669',
  date: '2026-09-03',
  title: 'Supply house invoices can be flagged "On job account"',
  kind: 'feature',
  highlights: [
    'Entering an invoice on Materials → Supply Houses? Once you assign the J#, a new "On job account" checkbox records that the house bills the property owner if the invoice goes unpaid — not you. You still pay the house as usual.',
    'When the job’s account packet was shared through the app, the checkbox confirms it — desk, date, and who sent it. No packet on record? You can still flag it, with a pointer to Job Detail → Share with supply house.',
    'Materials → Job Accounts now splits every owed number: a teal "On job accounts" card and filter, a your-account vs job-accounts split on the Holding card, and teal-striped bar slices that stay out of the past-due heat — those dollars are the house’s collection problem, not yours.',
    'Flagged invoices carry a small "Job acct" chip in the house’s invoice list and the Make Payment picker.',
  ],
}

export default note
