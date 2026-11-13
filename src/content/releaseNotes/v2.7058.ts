import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7058',
  date: '2026-11-12',
  title: 'Tasks: the groundwork for a place on a task',
  kind: 'infra',
  highlights: [
    'A task can now hold a place: a name such as Pump house and a point on the map. Nothing on screen uses it yet.',
    'This is the first of eight steps. The next ones add the Place row when you give a task, the map on the task, and a map of your tasks at the top of Today.',
    'A task with no place is unchanged.',
  ],
}

export default note
