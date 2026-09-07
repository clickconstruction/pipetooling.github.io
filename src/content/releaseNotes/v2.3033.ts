import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3033',
  date: '2026-09-07',
  title: 'Safety net under Dispatch crews',
  kind: 'fix',
  highlights: [
    'Creating, renaming, reordering and staffing the crews on Dispatch → People now has 7 tests pinning what each action writes and that a person moved to a new crew leaves the old one; no behaviour change.',
  ],
}

export default note
