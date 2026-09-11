import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3263',
  date: '2026-09-10',
  title: 'Groundwork for the robot price matrix',
  kind: 'infra',
  highlights: [
    'Supply-house quotes can now be stored the way vendors actually write them: a fixture priced as a kit (bowl + flush valve + seat under one "EACH" subtotal), a carrier priced on a separate sheet but belonging to that fixture, and size options that stay separate until you pick one.',
    'Nothing changes on screen yet. This is the first of five small steps toward "Price it with the robot" on Bids → Pricing — a robot that reads the quote PDFs in your folders and builds the best-price matrix, then asks you where the plans decide (which carrier, which size).',
  ],
}

export default note
