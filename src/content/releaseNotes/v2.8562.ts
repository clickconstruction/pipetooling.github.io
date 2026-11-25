import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8562',
  date: '2026-11-24',
  title: 'A reload that hangs after an update now lets go',
  kind: 'fix',
  highlights: [
    'Right after an update, the app could sit on “Updating app…” for a minute or more. The Reload press on a page that could not load could stay grey just as long.',
    'A reload now waits three seconds at most for its clean-up, then loads the app anyway.',
    'If the page is still there ten seconds after a reload starts, the Reload press comes back. It says “The reload did not finish. Press Reload to try again.”',
    '“Updating app…” gives way to the same Reload press and the Fix app link after those ten seconds, in place of standing for good.',
  ],
}

export default note
