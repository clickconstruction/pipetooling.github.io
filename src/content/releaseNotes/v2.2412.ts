import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2412',
  date: '2026-08-28',
  title: 'A deleted price option can now be fully restored from Recently deleted',
  kind: 'fix',
  highlights: [
    'Deleting a price option scattered its pieces across two Recently deleted bundles, so a restore preview stopped on a "parent no longer exists" blocker. Restore now gathers the whole set — the price option, its entries, custom prices, assignments, and hidden rows — from either bundle.',
    'The bundle is labeled by the price option ("Scenario B · Bid 398") instead of "Partial delete under 69491f86".',
    'Restores no longer abort when the archive holds an older duplicate of a row — the newest version comes back and the stale copy is skipped with a note.',
  ],
}

export default note
