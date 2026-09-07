import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2965',
  date: '2026-09-06',
  title: 'Housekeeping: database types regenerated',
  kind: 'fix',
  highlights: [
    'No visible change. The app\'s generated database type file was rebuilt from the live schema after today\'s migrations, so the reconciliation receipts, builder aliases, org defaults and dismissal tables, and the new RPCs, are typed from the source of truth instead of by hand.',
  ],
}

export default note
