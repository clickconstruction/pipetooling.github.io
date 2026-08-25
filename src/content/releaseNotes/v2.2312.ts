import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2312',
  date: '2026-08-25',
  title: 'Stuck loading screens offer a way out',
  kind: 'fix',
  highlights: [
    'If a page sits on "Loading…" more than 3 seconds, a countdown appears; at 10 seconds the screen offers Reload and Fix the app instead of leaving you stranded.',
    'Quick page changes look exactly as before — the countdown only shows when something is actually slow.',
  ],
}

export default note
