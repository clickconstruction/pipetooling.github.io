import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8059',
  date: '2026-11-20',
  title: 'Gear menu: the rows are in groups with small labels',
  kind: 'fix',
  highlights: [
    'The gear menu was one long list. It now reads in four groups, each under a small label: Modes, Show, Pages, and Help and settings.',
    'Sign out and Hard Reload sit last, under a grey band of their own.',
    'The pages are in one order now: the Checklist and the Calendar first, the office pages last. Nobody gained or lost a page.',
    'On a small phone the Tell the dev row that opens a note stays at the very top. The Tell the dev switch is the one under Show.',
  ],
}

export default note
