import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4370',
  date: '2026-10-02',
  title: 'Merge a duplicate waits for you to let go before closing',
  kind: 'fix',
  highlights: [
    'The Merge a duplicate window on a person’s desk closed the moment you pressed outside it. Now it closes only when you press and let go outside it, like every other window.',
  ],
}

export default note
