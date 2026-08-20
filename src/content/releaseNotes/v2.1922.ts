import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1922',
  date: '2026-08-20',
  title: 'Change orders introduce themselves as change orders',
  kind: 'fix',
  highlights: [
    'The customer-facing document for a change order was headed "Estimate for <customer>". It now reads "Change Order for <customer>" — on the signing page the customer opens, the staff preview, and the accepted-record view, including change orders sent before this fix.',
    'New change-order drafts also save their title as "Change Order for <customer>" when you pick the customer, so emails and lists match.',
  ],
}

export default note
