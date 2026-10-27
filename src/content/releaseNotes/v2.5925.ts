import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5925',
  date: '2026-10-26',
  title: 'Print a lien waiver for a notary',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Step 5 of the Release of Lien window gains a fourth way to sign: Print for a notary. The page prints with a proper Texas notary block — the venue, the sworn line naming the signer, and open space for the seal.',
    'The waiver then holds at Out for notary, so nobody signs it digitally while the paper is out. He signs it here instead takes the hold back.',
    'When the signed, stamped copy comes back, paste its Google Drive link and the waiver is signed on paper — the record says signed in ink before a Notary Public of the State of Texas.',
    'Send to the GC then links the notarized copy in the email, and the regenerated PDF carries the notary block with no pretend ink — the scan is the signature. Texas has not required notarized waivers since 2022; the button says so, so nobody prints one unasked.',
  ],
}

export default note
