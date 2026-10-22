import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5725',
  date: '2026-10-22',
  title: 'Messages: the walk kit’s own customer, made and removed in one call each',
  kind: 'infra',
  highlights: [
    'The database can now make the walk kit’s test customer, ZZ Walk Messages Desk, with the bids inbox as its email, the bids number as its phone and a $1.00 draft estimate, and remove every one of those rows again. A Claude session will use it to run the Messages loop end to end on the company’s own inbox and number.',
    'Setup refuses while any record already carries the bids address, the bids number, the team inbox’s address or number, or the app’s sender, and names the record. Nothing is made until the records are clean.',
    'Cleanup removes only the kit’s rows and refuses if a real person’s line, file or record has been folded in, so nothing of a customer’s is ever deleted by the kit.',
  ],
}

export default note
