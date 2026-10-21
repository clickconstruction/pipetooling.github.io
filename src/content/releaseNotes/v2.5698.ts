import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5698',
  date: '2026-10-20',
  title: 'Messages: our estimate emails open the estimate from the thread',
  kind: 'feature',
  highlights: [
    'In a thread, our estimate email showed its subject twice and gave no way to the estimate itself.',
    'The second line is now a button, Open estimate #166, that closes the thread and opens the estimate. A change order’s email opens the change order the same way.',
  ],
}

export default note
