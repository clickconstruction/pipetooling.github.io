import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3974',
  date: '2026-09-27',
  title: 'People → Review: the overhead rates have tests',
  kind: 'fix',
  highlights: [
    'The 90-day scan behind the Review tab’s overhead rates moved out of the tab into its own tested piece. The rates it shows are worked out exactly as before.',
  ],
}

export default note
