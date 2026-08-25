import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2267',
  date: '2026-08-25',
  title: 'Drag tasks between stages',
  kind: 'feature',
  highlights: [
    'In the Map\'s task-edit mode, drag a task by its grip out of one stage and drop it in another — the row floats above the map while you carry it.',
    'Drop between rows to pick the exact spot, or drop anywhere on a stage box — even a collapsed one — to send the task to the end ("Move here — becomes 7.3").',
    'The target stage lights up as you hover it, and letting go over empty canvas safely does nothing.',
    'The task keeps its people, notes, and history — only its number changes, and both stages renumber cleanly.',
  ],
}

export default note
