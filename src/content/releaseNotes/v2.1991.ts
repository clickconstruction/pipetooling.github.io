import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1991',
  date: '2026-08-21',
  title: 'The portal globe — share, preview, rotate',
  kind: 'feature',
  highlights: [
    "A globe icon now sits next to customer names on Customers, Pipeline, Job Detail, and Edit Job: click it to copy the customer's portal link, preview the page exactly as they see it, rotate the link, or turn it off.",
    'GCs get their own GC-flavored link via the As GC toggle.',
    'Portal links are now re-showable (stored, not hash-only) — same trust class as the Stripe invoice links we already keep.',
  ],
}

export default note
