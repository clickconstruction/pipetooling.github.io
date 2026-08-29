import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2480',
  date: '2026-08-29',
  title: 'RFIs live on the bid now',
  kind: 'feature',
  highlights: [
    'The Bids RFI tab keeps a queue: draft a question where the plans don’t say, approve it, pick which GCs it goes to, mark it sent, and record the answer when it comes back.',
    'Flags dropped while counting in CountTooling (notes starting with "RFI:") paste straight in as drafts with their sheet references.',
    'Every step writes a note on the bid, so the bid’s ledger tells the whole RFI story.',
  ],
}

export default note
