import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4538',
  date: '2026-10-05',
  title: 'Put a GC on notice: the jobs list has a plain title',
  kind: 'fix',
  highlights: [
    'In the Put a GC on notice window, the jobs list is now titled “Jobs with unpaid work under this GC”.',
    'The paragraph under the old title, which explained how the list works, is gone. The list itself is unchanged.',
  ],
}

export default note
