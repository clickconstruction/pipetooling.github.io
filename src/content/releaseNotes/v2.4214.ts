import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4214',
  date: '2026-09-29',
  title: 'The app updates itself when you switch tabs, too',
  kind: 'fix',
  highlights: [
    'When a new version is waiting, moving from one tab to another on the same page (People → Hours to People → Review, say) now counts as a quiet moment, the same as moving to another page. Before, only a change of page did, so a tab switch left the "A new version is ready" pill sitting there.',
    'The same rules hold: never while a window is open, a field has the cursor in it, something is still saving, or within ten minutes of Not now.',
    'Picking a bid, a lens or a filter on the same tab is not a move — the app stays put while you work.',
  ],
}

export default note
