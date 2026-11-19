import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7956',
  date: '2026-11-19',
  title: 'Lien notices: the enclosed invoice names who the bill went to',
  kind: 'fix',
  highlights: [
    'An invoice enclosed with a lien notice reads Bill to with the name the bill went to. On a job billed to its GC that is the GC. It read "Customer" when the job had no customer, and the customer\'s name when it had one.',
    'A bill typed to someone else reads that person\'s name.',
    'The same invoice opened from Documents, the Lien window, a lien claim or the GC\'s unpaid invoices reads the same name.',
    'A bill whose note says "Cheques can be sent to" no longer prints that note as the invoice\'s Scope.',
  ],
}

export default note
