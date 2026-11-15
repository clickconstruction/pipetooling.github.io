import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7363',
  date: '2026-11-15',
  title: 'Tasks: a task card can show a painted map that has no place',
  kind: 'infra',
  highlights: [
    'A task that carries a painted map and no place now shows the map’s name, its length and its places under the title.',
    'Opened, the task draws the whole line from above, with Open the map, Directions to the start and How far am I?',
    'Nothing sets a map with no place yet. The Map press in the New task window comes next.',
  ],
}

export default note
