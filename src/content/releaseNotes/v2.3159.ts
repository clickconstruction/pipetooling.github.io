import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3159',
  date: '2026-09-08',
  title: 'Bid Room: sign by drawing, not just typing',
  kind: 'feature',
  highlights: [
    'A GC approving a proposal in the Bid Room can now pick Type or Draw under their name — Draw opens a box to sign with a finger or mouse, exactly like the contract and lien signing pages. Change orders in the room get the same choice.',
    'A drawn signature is stored with the approval and shows on the signed record in the Estimates Ledger; a typed one still prints on the cursive line as before.',
    'The electronic-signing explanation now says "a typed or drawn signature," so the consent text stored with each signature is version 2 from here on.',
  ],
}

export default note
