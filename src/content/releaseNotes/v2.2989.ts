import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2989',
  date: '2026-09-07',
  title: 'Safety net under the Stages dates',
  kind: 'fix',
  highlights: [
    'The j: field date and b: billing date on every Stages line, and their tooltips, now have 11 tests pinning how they are chosen — no behaviour change.',
  ],
}

export default note
