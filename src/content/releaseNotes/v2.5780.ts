import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5780',
  date: '2026-10-23',
  title: 'Legal Desk: a full screen button, and a read that failed says so and tries again',
  kind: 'feature',
  highlights: [
    'The Legal Desk has the full screen button the other desks have, at the top right beside the ✕. Press it and the desk fills the screen. Press it again for the window. The desk remembers the choice on this computer.',
    'When the desk could not read the legal tables, it says so: Could not read the legal tables · Retry. It tries again on its own a few times. Before, one failed read showed Read-only until the legal tables are applied until the page was reloaded, on a desk whose tables were fine.',
    'The settlement floor boxes and the write-down boxes no longer warn in the browser console when the typed box changes.',
  ],
}

export default note
