import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4931',
  date: '2026-10-08',
  title: 'GC mode: bid tabs for the trades, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Press Bid tabs on a GC project’s card once a trade has two quotes. Each trade shows its quotes low to high.',
    'Share a tab once our bid is in. Each company sees its own row marked and the others as Another company.',
    'Tick Show company names to each other to show every name.',
    'Their copy says which companies opened their tab.',
  ],
}

export default note
