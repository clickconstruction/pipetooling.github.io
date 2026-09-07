import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3024',
  date: '2026-09-07',
  title: 'Safety net under Copy Day Job Mix',
  kind: 'fix',
  highlights: [
    'Copying one person’s day job mix onto another’s clock blocks now has 7 tests pinning how the blocks are cut, which notes carry over, and when a copy is refused; no behaviour change.',
  ],
}

export default note
