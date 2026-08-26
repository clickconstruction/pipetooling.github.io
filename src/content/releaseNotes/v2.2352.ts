import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2352',
  date: '2026-08-26',
  title: 'Invoice payment card gets room to breathe',
  kind: 'fix',
  highlights: [
    'The payment history card on invoice emails, PDFs, and the on-screen preview opens up: taller rows, real padding, and air around the rule — the portal card’s proportions.',
    'The redundant Billed line is gone on invoices — Amount due already sits right above the card. The portal keeps its Billed line, where nothing above the card states the total.',
  ],
}

export default note
