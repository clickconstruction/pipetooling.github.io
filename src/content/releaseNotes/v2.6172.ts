import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6172',
  date: '2026-10-30',
  title: 'Legal desk: who we have a contract with, who owns the building, and the venue, under the account’s name',
  kind: 'feature',
  highlights: [
    'Under an account’s name the Legal desk now draws three cells: Contract with, Owns the building, and Venue. Each is a name from the record, one quiet line of what the record says, and a door. The contract cell names the general contractor or the customer, who signed, and their city. The owner cell names the owner of record as the record spells it and where it mails. The venue cell names the county where the work was done, the justice precinct when the record has one, the county where the payer is, and whether the balance is within the justice court limit.',
    'A press on Contract with opens Edit customer. A press on Owns the building opens the property record on the customer’s profile. A press on Venue brings up the desk’s Map.',
    'A gap is an amber cell that says what is missing, and its press is the record that fills it: an owner not on the record, no property record, a county unknown, or a payer that is a name only. A homeowner who owns the building is one cell, not two.',
    'The line under the account’s name reads the building’s address now, not the payer’s office. The old venue sentence is gone; the firm segment in the header still says why this firm when you hover it.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
