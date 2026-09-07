import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3014',
  date: '2026-09-07',
  title: 'Safety net under Job Summary Days',
  kind: 'fix',
  highlights: [
    'The loader behind Job Summary’s Days and Timeline views now has 7 tests pinning what it reads for a window, how job labels, status spans and prior hours are built, and that its numbers reconcile by hand; no behaviour change.',
  ],
}

export default note
