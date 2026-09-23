import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3786',
  date: '2026-09-23',
  title: 'Lien desk Timeline: the book reads the contract-end date and the payment bond',
  kind: 'fix',
  highlights: [
    'The Timeline tab’s rows and Print the grid now read the contract-end date and the payment bond recorded on the job (Edit Job → Our contract on this job). A job with a contract-end date shows its § 53.057 retainage step dated on its row, and the grid prints the bond and the contract’s end instead of blanks.',
    'The desk’s Notices and Affidavits panes already read these; the book had been left reading none of them.',
  ],
}

export default note
