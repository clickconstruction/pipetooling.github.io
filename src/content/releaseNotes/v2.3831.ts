import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3831',
  date: '2026-09-25',
  title: 'Bank payments: a note stays with the deposit you wrote it on',
  kind: 'fix',
  highlights: [
    'In the Bank payments window, a note typed under one deposit stayed in the box when you moved to the next deposit (or used Apply & next), and was saved onto that next payment too.',
    'Picking another deposit now starts with an empty note, the same way the bill lines already start over.',
  ],
}

export default note
