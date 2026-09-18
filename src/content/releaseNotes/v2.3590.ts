import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3590',
  date: '2026-09-18',
  title: 'Stripe pay links: the portal and View bill fetch a fresh one on the spot',
  kind: 'fix',
  highlights: [
    "A customer opening their portal gets a pay link that works: any Stripe bill older than 25 days is re-checked with Stripe as the page loads and the current link is used, so the nightly renewal is no longer the only guard.",
    "View bill does the same for the office — Customer pay page and the Text · Copy link · Email cluster inside it use the link Stripe just handed back, and the bill's row keeps it.",
  ],
}

export default note
