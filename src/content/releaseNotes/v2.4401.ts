import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4401',
  date: '2026-10-02',
  title: '44 more windows say they are windows',
  kind: 'fix',
  highlights: [
    'A screen reader now announces 44 more windows as windows. Among them are the Workflow step windows, the Stages confirm windows and the delete confirms on Bids.',
    'The app holds the page still behind a window that says it is one, so these now lock at any size.',
    'A new window that leaves this out no longer reaches the app. The build stops it.',
  ],
}

export default note
