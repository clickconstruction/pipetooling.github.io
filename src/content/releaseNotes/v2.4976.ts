import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4976',
  date: '2026-10-08',
  title: 'People Review: the Team Summary’s loading moved to its own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the part of the Review tab that loads the Team Summary moved out of the tab into its own file.',
    'Nothing changes on screen. The summary still reloads a moment after you change the period, the paid-only box or the roster, and it still waits while a drilldown is open.',
    'Open in new window still reuses the rows already loaded when nothing has changed.',
    'New tests cover how it waits, reloads, keeps the newest answer and opens the window.',
  ],
}

export default note
