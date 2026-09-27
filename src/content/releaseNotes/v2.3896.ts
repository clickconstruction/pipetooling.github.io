import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3896',
  date: '2026-09-27',
  title: 'Controller access, batch 1: Materials and supply houses',
  kind: 'fix',
  highlights: [
    'A controller can now see Materials: supply houses, their invoices and balances, parts and prices, and purchase orders. Before, those pages came up empty for a controller login.',
    'This is the first of five updates that give the controller role everything the assistant role already has.',
  ],
}

export default note
