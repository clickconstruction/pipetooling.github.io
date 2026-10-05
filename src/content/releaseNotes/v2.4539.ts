import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4539',
  date: '2026-10-05',
  title: 'Put a GC on notice: one title line',
  kind: 'fix',
  highlights: [
    'In the Put a GC on notice window, the first notice chip and What this does now sit on the title’s line, to the right of the title. They had a line of their own under it.',
    'Click What this does to open its words under the title, and click it again to close them.',
    'On a narrow window the two wrap under the title as before.',
  ],
}

export default note
