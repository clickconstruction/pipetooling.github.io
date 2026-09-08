import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3164',
  date: '2026-09-08',
  title: 'Drawn signatures are visible again — white paper, dark ink, in both themes',
  kind: 'fix',
  highlights: [
    'The signature box on the Bid Room, contract and lien signing pages was painting itself black, so a drawn signature was almost invisible. It is now a white pad with dark ink whether the page is in light or dark mode.',
    'The saved signature image matches what the signer saw — dark ink on white — so the signed record in the Estimates Ledger and on printed copies reads the same way.',
  ],
}

export default note
