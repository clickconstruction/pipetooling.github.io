import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3467',
  date: '2026-09-14',
  title: 'Submittals: the package PDF — cover table, then every cut sheet stamped with its tag',
  kind: 'feature',
  highlights: [
    'Bids → Submittals → Build package: one PDF per revision. A cover table on our letterhead lists every row — tag, specified, submitted, status, reason, lead time, and the page its cut sheet starts on — then the sheets follow in tag order, each page stamped with the tag and status.',
    'The package is stored on the revision and opens in a new tab; Open package brings it back any time, and Rebuild package refreshes it after edits. Rows still owing a sheet are named on the cover as "to follow".',
  ],
}

export default note
