import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2605',
  date: '2026-09-01',
  title: 'Who owes what: re-email a physical invoice, PDF attached',
  kind: 'feature',
  highlights: [
    'Bills that went out as an emailed PDF invoice now have an "Email again — PDF attached" button on their card: confirm who receives it, and a freshly generated copy of the invoice goes right back out.',
    'Nothing about the bill changes on a re-send — it keeps its original billed date and evidence; the card just gets the customer their paperwork again.',
    'Cards now say how each bill went out: Stripe, emailed PDF, or billed in HouseCall Pro (which sends its own invoice).',
  ],
}

export default note
