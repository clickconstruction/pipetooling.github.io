import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3407',
  date: '2026-09-14',
  title: 'Takeoffs price the sticks: 105 ft needed buys 120 ft',
  kind: 'feature',
  highlights: [
    'A part sold in packs — 20 ft sticks of copper, 100 ft coils of PEX — is now rounded up once per bid, across every fixture that uses it, and the extra footage is in the materials total. Pricing, the Labor tab and the coverage strip all show the same number.',
    'The strip gains an “Order rounding” tile that says what the sticks add on this bid, and each line whose part rounds wears a small chip; hover it for “105 ft needed on this bid → 120 ft (6 × 20 ft sticks)”.',
    'The extra is spread over the fixtures that use the part by their share of the footage, so the per-fixture costs Pricing shows still add up to the bid. Bids priced before the rule existed do not move.',
  ],
}

export default note
