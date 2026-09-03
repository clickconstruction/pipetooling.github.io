import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2734',
  date: '2026-09-03',
  title: 'Timeline — working jobs set the floor',
  kind: 'fix',
  highlights: [
    'On Jobs → Job Summary → Timeline the stack is flipped: still-working jobs are now the bottom band, billed sits on them, and paid rides on top. The long-running work reads as a calm floor and the one-day calls, most of which are already paid, no longer shake the whole chart.',
  ],
}

export default note
