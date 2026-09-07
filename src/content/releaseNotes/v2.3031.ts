import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3031',
  date: '2026-09-07',
  title: 'Safety net under emailing a lien release',
  kind: 'fix',
  highlights: [
    'Emailing a signed lien release to the customer now has 7 tests pinning when it declines, which PDF is attached, how the wording is chosen and how each failure reads; no behaviour change.',
  ],
}

export default note
