import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3039',
  date: '2026-09-07',
  title: 'Safety net under Mercury duplicates',
  kind: 'fix',
  highlights: [
    'The Banking duplicates panel — finding likely double entries, marking one as the duplicate, and undoing it — now has 3 tests pinning what is asked of the database and how each pair is read; no behaviour change.',
  ],
}

export default note
