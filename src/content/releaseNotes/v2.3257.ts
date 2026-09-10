import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3257',
  date: '2026-09-10',
  title: 'The Bill tab says when a supply house job account is on file',
  kind: 'feature',
  highlights: [
    'Billing a customer whose materials sit on a supply house job account? A teal note now sits right above the Invoices list — who holds the account, when the packet went out, and what it means: if material invoices go unpaid, the house bills the property owner, not you.',
    'When any of the job’s unpaid supplier invoices are flagged "On job account", the note adds the dollars, with a Costs link for the detail. No packet on record — nothing shows.',
  ],
}

export default note
