import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4846',
  date: '2026-10-07',
  title: 'Projects: a GC project is tagged GC and opens on GC projects',
  kind: 'fix',
  highlights: [
    'A GC project on the Projects page carries a GC tag. Pressing it opens its card on GC projects.',
    'Opening a GC project from anywhere never makes it a plumbing workflow. The page says where it lives instead.',
    'Deleting a GC project from Edit project says what else goes with it.',
  ],
}

export default note
