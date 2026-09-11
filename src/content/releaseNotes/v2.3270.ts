import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3270',
  date: '2026-09-10',
  title: 'The pricing robot — a twin that reads quotes and never bids',
  kind: 'feature',
  highlights: [
    'A new robot seat, Twin Pricer 1, exists just to price: it claims your "Price it with the robot" requests, reads every page of the quote PDFs in your folders, and writes each vendor’s quote onto the bid the way the vendor wrote it — kits under one subtotal, the carrier from the second sheet attached to its fixture, size lists kept as options.',
    'It picks the cheapest complete kit per fixture and says why. Where the plans decide — which carrier variant, which size — it asks you on Bids → Audits instead of guessing, and the chip reads Matrix ready · n picks, m to settle.',
    'It is refused every bid verb by design and never emails a vendor or changes a cost. Devs start it from Robots → Console → Pricing robot; the seat is minted on Settings → Digital twins.',
  ],
}

export default note
