import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3010',
  date: '2026-09-07',
  title: 'Safety net under bank-category tags',
  kind: 'fix',
  highlights: [
    'Saving, re-homing, merging and deleting bank-category tags on the Banking accounting tab now has 10 tests pinning exactly what each action writes and the order it writes it in; no behaviour change.',
  ],
}

export default note
