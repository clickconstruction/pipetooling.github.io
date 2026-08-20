import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1908',
  date: '2026-08-20',
  title: 'Estimates Pipeline: empty drafts sweep away, real drafts show readiness',
  kind: 'feature',
  highlights: [
    'Empty drafts (no customer, title, or lines) no longer clutter Unsent — they collapse behind one "Clean up N empty drafts" button with a confirm.',
    'Every remaining draft shows how close it is to sendable: green-dot progress plus what\'s left ("2 left: the change · cost lines"), straight from the draft editor\'s step guide.',
    'Drafts with no line items show "—" instead of a misleading $0.00.',
  ],
}

export default note
