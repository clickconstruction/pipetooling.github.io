import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3362',
  date: '2026-09-12',
  title: 'Bill copies link to the right statement, and the send history names who was copied',
  kind: 'feature',
  highlights: [
    'A copy of a Stripe bill now ends with "See your statement any time" — the customer\'s people get the customer\'s portal, a GC copied on a homeowner\'s bill gets the GC\'s own portal.',
    'The Send Email invoice confirm\'s history shows, under each past send, who got a copy that time — so "did DRF get it?" has an answer per send.',
  ],
}

export default note
