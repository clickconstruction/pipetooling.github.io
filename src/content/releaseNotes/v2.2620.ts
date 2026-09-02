import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2620',
  date: '2026-09-02',
  title: 'Lien releases live in Documents and on the job activity feed',
  kind: 'feature',
  highlights: [
    'Documents → Jobs now lists every lien release under its job, beside the billed invoices — with awaiting-signature / signed ✓ chips and one click to reopen the exact document, signature included.',
    'Voided releases stay listed with a voided chip, so the paper trail never loses a page.',
    'The job\'s activity feed shows the whole release lifecycle — issued, signature requested, signed, voided — under a Release tag, right in the billing history.',
  ],
}

export default note
