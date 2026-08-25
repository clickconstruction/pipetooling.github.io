import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2305',
  date: '2026-08-25',
  title: 'Carry a task to another stage — with a check',
  kind: 'feature',
  highlights: [
    'Hold any task on the Map and every other stage is now a drop target — the stage under your pointer lights up, and dropping on a box (even collapsed) sends the task to its end.',
    'Letting go over a different stage asks first: a small card shows the task, where it came from, and the number it takes on arrival — Move task or Cancel.',
    'Reordering inside the same stage stays instant, no questions asked.',
  ],
}

export default note
