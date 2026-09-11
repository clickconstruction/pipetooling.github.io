import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3343',
  date: '2026-09-11',
  title: 'Cash App reconcile: a withheld amount in a memo is not a send',
  kind: 'fix',
  highlights: [
    'A memo like "-500 for motorcycle 1809.20 paid via cashapp" now matches only the $1,809.20 that was sent; the minus-prefixed $500 was held back and no longer claims a separate $500 send.',
  ],
}

export default note
