import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3631',
  date: '2026-09-19',
  title: 'Contracts: email the agreement as a PDF to sign by hand',
  kind: 'feature',
  highlights: [
    'On the Contract sweep, Email the PDF to sign sends the customer the agreement as a PDF to print, sign and send back — the way this office has actually gotten its contracts signed. It asks first and names the address.',
    'The email offers the signing link underneath as a second way, so a customer who would rather sign on a phone still can. Reminders go out as they do for any sent agreement.',
    'The job leaves the pile and reads "PDF emailed · awaiting signature". When the signed page comes back, File the signed copy in the contract window turns that same agreement into the signed record.',
    'The record says who sent it, to whom and when — unlike a PDF attached to your own email.',
  ],
}

export default note
