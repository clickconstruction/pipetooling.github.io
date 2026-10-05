import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4545',
  date: '2026-10-05',
  title: 'Put a GC on notice: each stage lists its own jobs that look wrong',
  kind: 'feature',
  highlights: [
    'In the Put a GC on notice window, the “look wrong” count on each stage’s header row is now a button, like the one in the line above the table.',
    'It lists only that stage’s jobs. Click one to scroll to its row and light it.',
    'When a stage has just one job that looks wrong, a click on the count jumps straight to that row.',
  ],
}

export default note
